import OpenAI from "openai";
import { db } from "@/db";
import { meetings, user, corrections } from "@/db/schema";
import { PREDEFINED_AGENTS } from "@/lib/predefined-agents";
import { eq, inArray } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify";

type TranscriptItem = {
  speaker_id: string;
  type: string;
  text: string;
  start_ts: number;
  stop_ts: number;
};

// ── Report schema (stored as JSON string in summary column) ──────────────────

export type AnnotatedSegment = {
  text: string;
  annotation?: {
    corrected: string;
    type: "grammar" | "vocabulary" | "technical";
    note: string;
  } | null;
};

export type ScoreDimension = {
  score: number;    // 1–5
  cefrLevel: string; // A1 | A2 | B1 | B2 | C1 | C2  (for English dims)
  notes: string;
};

export type TechDimension = {
  score: number;    // 1–5
  notes: string;
};

export type QuestionFeedback = {
  question: string;
  userAnswer: string;
  userAnswerAnnotated: AnnotatedSegment[];
  technicalScore: number; // 1–5
  feedback: string;
  strengths: string[];
  improvements: string[];
};

export type InterviewReport = {
  summary: string;
  englishLevel: string;            // overall CEFR level
  scores: {
    grammar: ScoreDimension;
    vocabulary: ScoreDimension;
    fluency: ScoreDimension;
    technicalKnowledge: TechDimension;
  };
  questions: QuestionFeedback[];
  overallStrengths: string[];
  overallImprovements: string[];
  recommendation: string;
};

// ── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
Eres un evaluador experto de entrevistas técnicas en inglés para candidatos hispanohablantes que practican para el mercado laboral tecnológico internacional.

Recibirás la transcripción de una entrevista de práctica de entrevista. Analízala cuidadosamente y devuelve ÚNICAMENTE un objeto JSON válido — sin markdown, sin explicaciones, solo JSON crudo — con esta estructura exacta:

{
  "summary": "<resumen de 2-3 oraciones sobre la entrevista , en español>",
  "englishLevel": "<nivel CEFR: A1 | A2 | B1 | B2 | C1 | C2>",
  "scores": {
    "grammar": {
      "score": <entero 1-5>,
      "cefrLevel": "<A1|A2|B1|B2|C1|C2>",
      "notes": "<una o dos oraciones sobre la calidad gramatical, en español>"
    },
    "vocabulary": {
      "score": <entero 1-5>,
      "cefrLevel": "<A1|A2|B1|B2|C1|C2>",
      "notes": "<una o dos oraciones sobre rango y precisión del vocabulario, en español>"
    },
    "fluency": {
      "score": <entero 1-5>,
      "cefrLevel": "<A1|A2|B1|B2|C1|C2>",
      "notes": "<una o dos oraciones sobre qué tan naturalmente y claramente se comunicó, en español>"
    },
    "technicalKnowledge": {
      "score": <entero 1-5>,
      "notes": "<una o dos oraciones sobre el conocimiento técnico general, en español>"
    }
  },
  "questions": [
    {
      "question": "<pregunta del entrevistador, en el idioma original>",
      "userAnswer": "<respuesta del candidato textual o paráfrasis cercana, en el idioma original>",
      "userAnswerAnnotated": [
        {
          "text": "<fragmento de texto del candidato>",
          "annotation": null
        },
        {
          "text": "<fragmento con error o mejora>",
          "annotation": {
            "corrected": "<forma correcta o término técnico equivalente>",
            "type": "<grammar | vocabulary | technical>",
            "note": "<breve explicación en español>"
          }
        }
      ],
      "technicalScore": <entero 1-5>,
      "feedback": "<una oración de retroalimentación general, en español>",
      "strengths": ["<punto en español>", "<punto en español>"],
      "improvements": ["<punto en español>"]
    }
  ],
  "overallStrengths": ["<fortaleza en español>", "<fortaleza en español>", "<fortaleza en español>"],
  "overallImprovements": ["<área de mejora en español>", "<área de mejora en español>", "<área de mejora en español>"],
  "recommendation": "<párrafo motivador de 2-3 oraciones con próximos pasos concretos, en español>"
}

Reglas importantes:
- Toda explicación, retroalimentación, fortalezas, áreas de mejora y recomendación deben estar en ESPAÑOL.
- Las citas textuales del candidato (userAnswer, userAnswerAnnotated[].text) y las preguntas del entrevistador (question) se mantienen en el idioma original (inglés).
- NUNCA incluyas ejemplos de código en ninguna parte del JSON. Esta es una práctica de entrevista por voz; las sugerencias de mejora deben ser conceptuales y verbales, no técnicas con sintaxis de programación.
- Si el candidato omitió una pregunta o no respondió, indica "(sin respuesta)" en userAnswer y deja userAnswerAnnotated como array vacío [].

Reglas para userAnswerAnnotated:
- Divide la respuesta del candidato en segmentos naturales (palabras, frases cortas).
- Solo anota segmentos que contengan errores claros o mejoras relevantes de vocabulario técnico.
- No fragmentes en exceso el texto sin anotación — los fragmentos correctos pueden ser frases más largas.
- Tipos de anotación:
  * "grammar": error gramatical (tiempo verbal incorrecto, concordancia, artículo faltante, etc.)
  * "vocabulary": palabra imprecisa o informal que podría expresarse mejor en inglés general
  * "technical": descripción no técnica de un concepto que tiene un término técnico preciso en el campo de tecnología

Guía de puntuación (1–5):
1 = Muy deficiente  2 = Por debajo del promedio  3 = Aceptable  4 = Bueno  5 = Excelente

Guía CEFR:
A1 = Principiante  A2 = Elemental  B1 = Intermedio  B2 = Intermedio alto  C1 = Avanzado  C2 = Competente
`.trim();

// ── Main function ─────────────────────────────────────────────────────────────

export async function generateMeetingSummary(
  meetingId: string,
  transcriptText: string,
  userId?: string,
): Promise<void> {
  try {
    // 1. Parse transcript
    let items: TranscriptItem[] = [];
    const text = transcriptText?.trim();
    if (text && text !== " ") {
      try {
        items = JSONL.parse<TranscriptItem>(text);
      } catch {
        console.error("[generateSummary] JSONL parse failed for", meetingId);
      }
    }

    if (items.length === 0) {
      await db.update(meetings)
        .set({ status: "completed", summary: JSON.stringify({ summary: "La entrevista no tuvo respuestas registradas.", englishLevel: "—", scores: { grammar: { score: 0, cefrLevel: "—", notes: "" }, vocabulary: { score: 0, cefrLevel: "—", notes: "" }, fluency: { score: 0, cefrLevel: "—", notes: "" }, technicalKnowledge: { score: 0, notes: "" } }, questions: [], overallStrengths: [], overallImprovements: [], recommendation: "" } satisfies InterviewReport) })
        .where(eq(meetings.id, meetingId));
      return;
    }

    // 2. Resolve speaker names
    const speakerIds = [...new Set(items.map((i) => i.speaker_id))];
    const dbUsers = await db.select().from(user).where(inArray(user.id, speakerIds));
    const agentSpeakers = PREDEFINED_AGENTS
      .filter((a) => speakerIds.includes(a.id))
      .map((a) => ({ id: a.id, name: `${a.role} (Interviewer)` }));

    const speakerMap = new Map<string, string>();
    dbUsers.forEach((u) => speakerMap.set(u.id, u.name));
    agentSpeakers.forEach((a) => speakerMap.set(a.id, a.name));

    const readable = items.map((item) => ({
      speaker: speakerMap.get(item.speaker_id) ?? "Unknown",
      text: item.text,
    }));

    // 3. Call GPT-4o
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: "Here is the session transcript:\n\n" + JSON.stringify(readable, null, 2),
        },
      ],
    });

    const raw = completion.choices[0].message.content ?? "{}";

    // 4. Validate it parses correctly, then store
    const report = JSON.parse(raw) as InterviewReport;
    await db
      .update(meetings)
      .set({ summary: raw, status: "completed" })
      .where(eq(meetings.id, meetingId));

    // 5. Save annotations as corrections in the vocabulary notebook
    if (userId && report.questions?.length > 0) {
      const entries = report.questions.flatMap((q) =>
        (q.userAnswerAnnotated ?? [])
          .filter((seg) => seg.annotation != null)
          .map((seg) => ({
            userId,
            meetingId,
            original: seg.text,
            corrected: seg.annotation!.corrected,
            type: seg.annotation!.type,
            note: seg.annotation!.note,
          }))
      );
      if (entries.length > 0) {
        await db.insert(corrections).values(entries);
      }
    }
  } catch (err) {
    console.error("[generateSummary] Error for meeting", meetingId, err);
    await db
      .update(meetings)
      .set({ status: "completed", summary: "{}" })
      .where(eq(meetings.id, meetingId));
  }
}

import OpenAI from "openai";
import { db } from "@/db";
import { meetings, user, corrections } from "@/db/schema";
import { PREDEFINED_AGENTS } from "@/lib/predefined-agents";
import { and, eq, inArray } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify";
import { awardAchievements } from "@/lib/award-achievements";
import { AI_MODELS } from "@/lib/ai-models";
import { getTopicTitle } from "@/lib/interview-topics";
import { NO_ANSWER, TOTAL_QUESTIONS } from "@/modules/call/constants";
import { loadPlan, mapAnswersToPlan, recordPlanResults, type StoredQuestion } from "@/modules/call/server/plan";
import { overallTechnicalScore } from "@/modules/call/report-scoring";

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
  /** Position in the question plan (1–10). Absent in reports made before plans existed. */
  position?: number;
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
- CRÍTICO: El nivel CEFR y los scores SOLO pueden basarse en respuestas reales del candidato. Si la mayoría de respuestas son "(sin respuesta)", los scores deben ser 0 o 1 y el englishLevel debe ser "N/A". NUNCA asumas un nivel alto por ausencia de errores — la falta de respuesta no es evidencia de competencia.

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

// Extra rules when the interview has a question plan (all new interviews).
const PLAN_RULES = `
MODO PLAN DE PREGUNTAS (sustituye a la transcripción):
Recibirás la lista de las ${TOTAL_QUESTIONS} preguntas de la entrevista. Cada elemento trae: position, type ("technical" | "soft"), topic, level (1 = explicar el concepto, 2 = comparar, 3 = aplicar a un escenario sencillo), question, reference (conceptos esperados en preguntas técnicas, o criterios STAR en soft skills) y candidateAnswer.
- Devuelve en "questions" exactamente un objeto por pregunta, en el mismo orden, y agrega a cada uno el campo "position" con el mismo número que recibiste.
- "question" debe ser el texto de la pregunta tal como viene.
- technicalScore en preguntas técnicas: qué tanto cubre la respuesta los conceptos de reference, considerando el nivel. En nivel 1 basta una explicación básica correcta; no exijas todos los conceptos. Es un puesto entry-level: califica con ese estándar.
- technicalScore en soft skills: calidad de la respuesta según los criterios de reference (situación, acciones propias y resultado claros).
- Si candidateAnswer es "${NO_ANSWER}": userAnswer "${NO_ANSWER}", userAnswerAnnotated [] y technicalScore 1.
- scores.technicalKnowledge.notes se basa solo en las preguntas de tipo "technical" (su score se recalcula en el sistema a partir de los technicalScore).
`.trim();

function buildPlanInput(plan: StoredQuestion[], answers: Map<number, string>) {
  return plan.map((q) => ({
    position: q.position,
    type: q.kind,
    topic: getTopicTitle(q.topicId),
    level: q.kind === "technical" ? q.level : undefined,
    question: q.question,
    reference: q.expectedConcepts,
    candidateAnswer: answers.get(q.position) ?? NO_ANSWER,
  }));
}

/** Per-position scores from the report; unanswered questions are null. */
function scoresFromReport(plan: StoredQuestion[], answers: Map<number, string>, report: InterviewReport) {
  const scores = new Map<number, number | null>();
  plan.forEach((q, index) => {
    if ((answers.get(q.position) ?? NO_ANSWER) === NO_ANSWER) {
      scores.set(q.position, null);
      return;
    }
    const fb = report.questions?.find((r) => r.position === q.position) ?? report.questions?.[index];
    const raw = Math.round(Number(fb?.technicalScore));
    if (Number.isFinite(raw) && raw >= 1) scores.set(q.position, Math.min(5, raw));
    // Missing score: leave the topic's progress untouched.
  });
  return scores;
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function generateMeetingSummary(
  meetingId: string,
  transcriptText: string,
  userId?: string,
): Promise<void> {
  try {
    const meetingScope = () => userId
      ? and(eq(meetings.id, meetingId), eq(meetings.userId, userId))
      : eq(meetings.id, meetingId);
    const [initialMeeting] = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(meetingScope());
    if (!initialMeeting) return;

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
        .where(meetingScope());
      return;
    }

    // 2. Build the evaluator input. New interviews have a question plan; older
    //    ones (started before plans existed) are evaluated from the transcript.
    const [meetingRow] = await db
      .select({ agentId: meetings.agentId })
      .from(meetings)
      .where(eq(meetings.id, meetingId));
    const plan = await loadPlan(meetingId);
    const hasPlan = !!meetingRow && plan.length === TOTAL_QUESTIONS;

    let hasRealAnswers: boolean;
    let systemPrompt = SYSTEM_PROMPT;
    let userContent: string;
    let answers = new Map<number, string>();

    if (hasPlan) {
      answers = mapAnswersToPlan(items, meetingRow.agentId, plan.length);
      hasRealAnswers = [...answers.values()].some((a) => a !== NO_ANSWER && a.trim().length > 0);
      systemPrompt = `${SYSTEM_PROMPT}\n\n${PLAN_RULES}`;
      userContent =
        "Here is the interview plan with the candidate's answers:\n\n" +
        JSON.stringify(buildPlanInput(plan, answers), null, 2);
    } else {
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

      const userIds = new Set(dbUsers.map((u) => u.id));
      hasRealAnswers = items
        .filter((item) => userIds.has(item.speaker_id))
        .some((item) => item.text !== NO_ANSWER && item.text.trim().length > 0);
      userContent = "Here is the session transcript:\n\n" + JSON.stringify(readable, null, 2);
    }

    if (!hasRealAnswers) {
      await db
        .update(meetings)
        .set({
          status: "completed",
          summary: JSON.stringify({
            summary: "El candidato no proporcionó respuestas durante la entrevista.",
            englishLevel: "N/A",
            scores: {
              grammar:            { score: 0, cefrLevel: "N/A", notes: "No hubo respuestas para evaluar." },
              vocabulary:         { score: 0, cefrLevel: "N/A", notes: "No hubo respuestas para evaluar." },
              fluency:            { score: 0, cefrLevel: "N/A", notes: "No hubo respuestas para evaluar." },
              technicalKnowledge: { score: 0,                   notes: "No hubo respuestas para evaluar." },
            },
            questions:            [],
            overallStrengths:     [],
            overallImprovements:  ["Participar activamente respondiendo las preguntas del entrevistador."],
            recommendation: "No fue posible generar una evaluación porque no se registraron respuestas. Intenta de nuevo y responde las preguntas cuando sea tu turno.",
          } satisfies InterviewReport),
        })
        .where(eq(meetings.id, meetingId));
      return;
    }

    // 5. Call the evaluation model
    // Do not send transcript data to the provider if the account was deleted
    // while the job was preparing the prompt.
    const [meetingBeforeOpenAI] = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(meetingScope());
    if (!meetingBeforeOpenAI) return;

    // 5. Call GPT-4o
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await openai.chat.completions.create({
      model: AI_MODELS.evaluation,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0].message.content ?? "{}";

    // 4. Validate it parses correctly, then store
    const report = JSON.parse(raw) as InterviewReport;
    // The account may have been deleted while OpenAI was processing. Drop the
    // result instead of recreating any data for an account that no longer exists.
    const [meetingAfterOpenAI] = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(meetingScope());
    if (!meetingAfterOpenAI) return;

    // With a plan, the per-question scores are the source of truth: unanswered
    // questions are fixed at 1 and the overall technical score is computed
    // here as their average instead of trusting the model's own number.
    const planScores = hasPlan ? scoresFromReport(plan, answers, report) : null;
    if (planScores) {
      plan.forEach((q, index) => {
        const fb = report.questions?.find((r) => r.position === q.position) ?? report.questions?.[index];
        const score = planScores.get(q.position);
        if (fb && score !== undefined) fb.technicalScore = score ?? 1;
      });

      const overall = overallTechnicalScore(
        plan.map((q) => ({ kind: q.kind, score: planScores.get(q.position) })),
      );
      if (overall !== null && report.scores?.technicalKnowledge) {
        report.scores.technicalKnowledge.score = overall;
      }
    }

    await db
      .update(meetings)
      .set({ summary: planScores ? JSON.stringify(report) : raw, status: "completed" })
      .where(meetingScope());

    // 5. Award achievements
    if (userId) {
      await awardAchievements(meetingId, userId, report);
    }

    // 6. Save annotations as corrections in the vocabulary notebook
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

    // 7. Per-question scores and topic progress (drives the next plans).
    //    Isolated so a failure here never discards the report already saved.
    if (userId && planScores) {
      try {
        await recordPlanResults(userId, plan, planScores);
      } catch (err) {
        console.error("[generateSummary] topic progress update failed for", meetingId, err);
      }
    }
  } catch (err) {
    console.error("[generateSummary] Error for meeting", meetingId, err);
    await db
      .update(meetings)
      .set({ status: "completed", summary: "{}" })
      .where(userId
        ? and(eq(meetings.id, meetingId), eq(meetings.userId, userId))
        : eq(meetings.id, meetingId));
  }
}

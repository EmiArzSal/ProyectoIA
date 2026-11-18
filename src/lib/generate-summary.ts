import OpenAI from "openai";
import { db } from "@/db";
import { meetings, user, corrections } from "@/db/schema";
import { PREDEFINED_AGENTS } from "@/lib/predefined-agents";
import { and, eq, inArray, isNull } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify";
import { buildAchievementWrites } from "@/lib/award-achievements";
import { localDate } from "@/lib/dates";
import { AI_MODELS } from "@/lib/ai-models";
import { getTopicTitle } from "@/lib/interview-topics";
import { NO_ANSWER, TOTAL_QUESTIONS } from "@/modules/call/constants";
import { buildPlanResultWrites, loadPlan, mapAnswersToPlan, type StoredQuestion } from "@/modules/call/server/plan";
import { z } from "zod";
import {
  CEFR_LEVELS,
  cefrToScore,
  overallEnglishLevel,
  overallScore,
  rebuildSegments,
  starScore,
  type Star,
} from "@/modules/call/report-scoring";

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
  score: number;    // 1–5 (derived from cefrLevel in planned interviews)
  cefrLevel: string; // A1 | A2 | B1 | B2 | C1 | C2  (for English dims)
  notes: string;
  /** Up to 2 verbatim quotes from the candidate that justify the level. */
  evidence?: string[];
};

export type TechDimension = {
  score: number;    // 1–5
  notes: string;
};

export type QuestionFeedback = {
  /** Position in the question plan (1–10). Absent in reports made before plans existed. */
  position?: number;
  kind?: "technical" | "soft";
  question: string;
  userAnswer: string;
  userAnswerAnnotated: AnnotatedSegment[];
  technicalScore: number; // 1–5 (soft skills: derived from star)
  /** Soft-skill questions only: which STAR elements the answer included. */
  star?: Star;
  feedback: string;
  strengths: string[];
  improvements: string[];
};

export type InterviewReport = {
  summary: string;
  englishLevel: string;            // overall CEFR level, or "N/A" without enough answers
  scores: {
    grammar: ScoreDimension;
    vocabulary: ScoreDimension;
    fluency: ScoreDimension;
    technicalKnowledge: TechDimension;
    /** Planned interviews only: average of the soft-skill questions. */
    softSkills?: TechDimension;
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

// ── Plan-mode evaluation (all new interviews) ────────────────────────────────
// The model returns EVIDENCE (CEFR level per dimension with quotes, STAR
// elements, per-question technical scores, error fragments) in a strict JSON
// schema. Everything the user sees as a headline number is computed in code
// from that evidence (see src/modules/call/report-scoring.ts).

const PLAN_PROMPT = `
Eres un evaluador experto de entrevistas de trabajo en inglés para candidatos hispanohablantes que practican para puestos ENTRY-LEVEL (junior / prácticas) del sector tecnológico. La entrevista fue hablada y transcrita automáticamente.

Recibirás las ${TOTAL_QUESTIONS} preguntas de la entrevista. Cada una trae: position, type ("technical" | "soft"), topic, level (solo técnicas: 1 = explicar el concepto, 2 = comparar, 3 = aplicar a un escenario sencillo), question, reference (conceptos esperados en técnicas; criterios STAR en soft) y candidateAnswer ("${NO_ANSWER}" si no respondió).

Devuelve un JSON con el esquema indicado. Reglas:

1. INGLÉS (english.grammar, english.vocabulary, english.fluency)
- Asigna un nivel CEFR por dimensión usando SOLO las respuestas reales y los descriptores de abajo. La ausencia de errores en respuestas muy cortas NO es evidencia de un nivel alto.
- evidence: hasta 2 citas TEXTUALES, copiadas exactamente de candidateAnswer, que justifiquen el nivel. No inventes ni corrijas las citas.
- notes: una o dos oraciones en español.

Gramática
- A1: frases sueltas o memorizadas; casi no conjuga verbos.
- A2: oraciones simples en presente; errores básicos frecuentes (verbo to be, -s de tercera persona, pasado) que a veces dificultan entender.
- B1: usa presente y pasado con errores frecuentes que no impiden entender; une oraciones simples con and, but, because.
- B2: buen control; errores ocasionales que no causan malentendidos; usa oraciones compuestas y condicionales.
- C1: errores raros y poco visibles; estructuras complejas con naturalidad.
- C2: control consistente, sin errores relevantes.

Vocabulario
- A1: palabras aisladas muy básicas.
- A2: vocabulario cotidiano limitado; repite palabras o recurre al español.
- B1: suficiente para explicar temas conocidos; algunos términos técnicos básicos; da rodeos cuando no sabe una palabra.
- B2: buen rango; términos técnicos adecuados en general; poca repetición.
- C1: amplio y preciso, con términos técnicos y expresiones naturales.
- C2: preciso y matizado en todo momento.

Fluidez (la transcripción puede ocultar pausas: juzga por la extensión, continuidad y organización de las respuestas)
- A1: respuestas de pocas palabras, fragmentadas.
- A2: respuestas cortas, ideas desconectadas, muchas muletillas o reinicios.
- B1: varias oraciones seguidas con conectores simples; algunas vacilaciones.
- B2: respuestas desarrolladas y bien conectadas; vacilaciones ocasionales.
- C1: discurso fluido y organizado con conectores variados.
- C2: discurso natural y sin esfuerzo.

2. PREGUNTAS: devuelve en "questions" un objeto por cada pregunta, con su mismo "position".
- technicalScore (preguntas "technical"): qué tanto cubre la respuesta los conceptos de reference, considerando el nivel. En nivel 1 basta una explicación básica correcta; no exijas todos los conceptos. Califica con estándar entry-level. 1 = incorrecta o no relacionada, 3 = parcialmente correcta, 5 = correcta y clara para el nivel. En preguntas "soft" pon 1 (el sistema la calcula con STAR).
- star (preguntas "soft"): marca true solo si el elemento aparece en la respuesta: situation (describe un contexto concreto), task (su responsabilidad u objetivo), action (lo que el candidato hizo personalmente), result (resultado o aprendizaje). En preguntas "technical" pon todo en false.
- annotations: SOLO los fragmentos con errores claros, copiados EXACTAMENTE de candidateAnswer, en el orden en que aparecen. Cada fragmento debe ser CORTO (de 1 a 6 palabras): solo las palabras con el error, nunca la oración completa. Si una oración tiene varios errores, crea una anotación por cada uno. type: "grammar" (error gramatical), "vocabulary" (palabra imprecisa o informal), "technical" (descripción no técnica de un concepto que tiene un término técnico preciso). corrected: la forma correcta en inglés. note: explicación breve en español.
- feedback: una oración en español. strengths e improvements: puntos breves en español.
- Si candidateAnswer es "${NO_ANSWER}": technicalScore 1, star todo false, annotations [], feedback "", strengths [], improvements [].

3. GENERAL (en español): summary (2-3 oraciones), technicalNotes (sobre las preguntas técnicas), softSkillsNotes (sobre las de soft skills, mencionando qué elementos STAR suelen faltar), overallStrengths (hasta 3), overallImprovements (hasta 3), recommendation (2-3 oraciones con próximos pasos concretos).

IDIOMA: todos los textos para el usuario (summary, notes, technicalNotes, softSkillsNotes, feedback, strengths, improvements, overallStrengths, overallImprovements, recommendation y note de cada anotación) van en ESPAÑOL. Solo van en inglés las citas del candidato (evidence, annotations.text) y las correcciones (annotations.corrected).

Nunca incluyas ejemplos de código: es una entrevista hablada y las sugerencias deben ser verbales.
`.trim();

const CEFR_ENUM = [...CEFR_LEVELS];
const dimensionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["level", "notes", "evidence"],
  properties: {
    level: { type: "string", enum: CEFR_ENUM },
    notes: { type: "string" },
    evidence: { type: "array", items: { type: "string" } },
  },
};
const stringArray = { type: "array", items: { type: "string" } };

const EVALUATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "english", "technicalNotes", "softSkillsNotes", "questions", "overallStrengths", "overallImprovements", "recommendation"],
  properties: {
    summary: { type: "string" },
    english: {
      type: "object",
      additionalProperties: false,
      required: ["grammar", "vocabulary", "fluency"],
      properties: { grammar: dimensionSchema, vocabulary: dimensionSchema, fluency: dimensionSchema },
    },
    technicalNotes: { type: "string" },
    softSkillsNotes: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["position", "technicalScore", "star", "annotations", "feedback", "strengths", "improvements"],
        properties: {
          position: { type: "integer" },
          technicalScore: { type: "integer", enum: [1, 2, 3, 4, 5] },
          star: {
            type: "object",
            additionalProperties: false,
            required: ["situation", "task", "action", "result"],
            properties: {
              situation: { type: "boolean" },
              task: { type: "boolean" },
              action: { type: "boolean" },
              result: { type: "boolean" },
            },
          },
          annotations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "corrected", "type", "note"],
              properties: {
                text: { type: "string" },
                corrected: { type: "string" },
                type: { type: "string", enum: ["grammar", "vocabulary", "technical"] },
                note: { type: "string" },
              },
            },
          },
          feedback: { type: "string" },
          strengths: stringArray,
          improvements: stringArray,
        },
      },
    },
    overallStrengths: stringArray,
    overallImprovements: stringArray,
    recommendation: { type: "string" },
  },
} as const;

const cefrZ = z.enum(CEFR_LEVELS);
const dimensionZ = z.object({ level: cefrZ, notes: z.string(), evidence: z.array(z.string()) });
const evaluationZ = z.object({
  summary: z.string().min(1),
  english: z.object({ grammar: dimensionZ, vocabulary: dimensionZ, fluency: dimensionZ }),
  technicalNotes: z.string(),
  softSkillsNotes: z.string(),
  questions: z.array(z.object({
    position: z.number().int(),
    technicalScore: z.number().int().min(1).max(5),
    star: z.object({ situation: z.boolean(), task: z.boolean(), action: z.boolean(), result: z.boolean() }),
    annotations: z.array(z.object({
      text: z.string(),
      corrected: z.string(),
      type: z.enum(["grammar", "vocabulary", "technical"]),
      note: z.string(),
    })),
    feedback: z.string(),
    strengths: z.array(z.string()),
    improvements: z.array(z.string()),
  })),
  overallStrengths: z.array(z.string()),
  overallImprovements: z.array(z.string()),
  recommendation: z.string(),
});
type ModelEvaluation = z.infer<typeof evaluationZ>;

type PlanQuestion = Pick<StoredQuestion, "position" | "kind" | "topicId" | "level" | "question" | "expectedConcepts">;

function buildPlanInput(plan: PlanQuestion[], answers: Map<number, string>) {
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

const isAnswered = (a: string | undefined) => !!a && a !== NO_ANSWER && a.trim().length > 0;

/**
 * Builds the stored report from the model's evidence. Throws (so the step is
 * retried) if an answered question has no evaluation; everything else that is
 * off is repaired here.
 */
export function buildPlanReport(
  plan: PlanQuestion[],
  answers: Map<number, string>,
  model: ModelEvaluation,
): EvaluationResult {
  const byPosition = new Map<number, ModelEvaluation["questions"][number]>();
  for (const q of model.questions) if (!byPosition.has(q.position)) byPosition.set(q.position, q);

  const answeredText = plan.map((q) => answers.get(q.position)).filter(isAnswered).join("\n").toLowerCase();
  const realAnswers = plan.filter((q) => isAnswered(answers.get(q.position))).length;

  const questions: QuestionFeedback[] = plan.map((q) => {
    const answer = answers.get(q.position) ?? NO_ANSWER;
    const ev = byPosition.get(q.position);
    const kind = q.kind === "soft" ? "soft" : "technical";

    if (!isAnswered(answer)) {
      return {
        position: q.position, kind, question: q.question, userAnswer: NO_ANSWER,
        userAnswerAnnotated: [], technicalScore: 1,
        ...(kind === "soft" ? { star: { situation: false, task: false, action: false, result: false } } : {}),
        feedback: ev?.feedback ?? "", strengths: [], improvements: ev?.improvements ?? [],
      };
    }
    if (!ev) throw new Error(`Evaluation is missing answered question ${q.position}`);

    const segments = rebuildSegments(
      answer,
      ev.annotations.map((a) => ({ text: a.text, annotation: { corrected: a.corrected, type: a.type, note: a.note } })),
    );
    return {
      position: q.position,
      kind,
      question: q.question,
      userAnswer: answer,
      userAnswerAnnotated: segments,
      technicalScore: kind === "soft" ? starScore(ev.star) : ev.technicalScore,
      ...(kind === "soft" ? { star: ev.star } : {}),
      feedback: ev.feedback,
      strengths: ev.strengths,
      improvements: ev.improvements,
    };
  });

  // Keep only quotes the candidate actually said.
  const dimension = (d: ModelEvaluation["english"]["grammar"]): ScoreDimension => ({
    score: cefrToScore(d.level),
    cefrLevel: d.level,
    notes: d.notes,
    evidence: d.evidence.map((e) => e.trim()).filter((e) => e && answeredText.includes(e.toLowerCase())).slice(0, 2),
  });

  const { grammar, vocabulary, fluency } = model.english;
  const scored = questions.map((q) => ({
    kind: q.kind ?? "technical",
    score: q.userAnswer === NO_ANSWER ? null : q.technicalScore,
  }));

  const report: InterviewReport = {
    summary: model.summary,
    englishLevel: overallEnglishLevel([grammar.level, vocabulary.level, fluency.level], realAnswers),
    scores: {
      grammar: dimension(grammar),
      vocabulary: dimension(vocabulary),
      fluency: dimension(fluency),
      technicalKnowledge: { score: overallScore(scored, "technical") ?? 1, notes: model.technicalNotes },
      softSkills: { score: overallScore(scored, "soft") ?? 1, notes: model.softSkillsNotes },
    },
    questions,
    overallStrengths: model.overallStrengths.slice(0, 3),
    overallImprovements: model.overallImprovements.slice(0, 3),
    recommendation: model.recommendation,
  };

  const planScores: [number, number | null][] = questions.map((q) => [
    q.position!,
    q.userAnswer === NO_ANSWER ? null : q.technicalScore,
  ]);
  return { report, planScores };
}

/** Calls the evaluator for a planned interview and builds the report. */
export async function evaluatePlanAnswers(plan: PlanQuestion[], answers: Map<number, string>): Promise<EvaluationResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const completion = await openai.chat.completions.create({
    model: AI_MODELS.evaluation,
    temperature: 0,
    seed: 7,
    response_format: {
      type: "json_schema",
      json_schema: { name: "interview_evaluation", strict: true, schema: EVALUATION_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      { role: "system", content: PLAN_PROMPT },
      {
        role: "user",
        content: "Interview questions with the candidate's answers:\n\n" + JSON.stringify(buildPlanInput(plan, answers), null, 2),
      },
    ],
  });

  // Invalid JSON or schema mismatch throws, so the step is retried.
  const parsed = evaluationZ.parse(JSON.parse(completion.choices[0]?.message.content ?? ""));
  return buildPlanReport(plan, answers, parsed);
}

// ── Evaluation job, split into steps ─────────────────────────────────────────
// Called from the Inngest function (src/inngest/functions.ts), one step each:
//   prepare → evaluate → rewards → corrections → save report
// Errors are NOT swallowed: they propagate so Inngest retries the step, and
// after the last retry onFailure marks the meeting "failed" (the user can
// retry). Every write step is idempotent, so retries never duplicate data.
// The report is saved last: until then the meeting stays "processing".

const NO_ITEMS_REPORT: InterviewReport = {
  summary: "La entrevista no tuvo respuestas registradas.",
  englishLevel: "—",
  scores: {
    grammar:            { score: 0, cefrLevel: "—", notes: "" },
    vocabulary:         { score: 0, cefrLevel: "—", notes: "" },
    fluency:            { score: 0, cefrLevel: "—", notes: "" },
    technicalKnowledge: { score: 0, notes: "" },
  },
  questions: [],
  overallStrengths: [],
  overallImprovements: [],
  recommendation: "",
};

const NO_ANSWERS_REPORT: InterviewReport = {
  summary: "El candidato no proporcionó respuestas durante la entrevista.",
  englishLevel: "N/A",
  scores: {
    grammar:            { score: 0, cefrLevel: "N/A", notes: "No hubo respuestas para evaluar." },
    vocabulary:         { score: 0, cefrLevel: "N/A", notes: "No hubo respuestas para evaluar." },
    fluency:            { score: 0, cefrLevel: "N/A", notes: "No hubo respuestas para evaluar." },
    technicalKnowledge: { score: 0,                   notes: "No hubo respuestas para evaluar." },
  },
  questions:           [],
  overallStrengths:    [],
  overallImprovements: ["Participar activamente respondiendo las preguntas del entrevistador."],
  recommendation: "No fue posible generar una evaluación porque no se registraron respuestas. Intenta de nuevo y responde las preguntas cuando sea tu turno.",
};

const meetingScope = (meetingId: string, userId: string) =>
  and(eq(meetings.id, meetingId), eq(meetings.userId, userId));

/** The account may be deleted while the job runs (cascade deletes the meeting). */
async function meetingExists(meetingId: string, userId: string) {
  const [row] = await db.select({ id: meetings.id }).from(meetings).where(meetingScope(meetingId, userId));
  return !!row;
}

function parseTranscriptItems(transcriptText: string | null | undefined): TranscriptItem[] {
  const text = transcriptText?.trim();
  if (!text) return [];
  try {
    return JSONL.parse<TranscriptItem>(text);
  } catch {
    console.error("[evaluation] JSONL parse failed");
    return [];
  }
}

export type EvaluationJob =
  | { kind: "gone" }
  | { kind: "static"; report: InterviewReport }
  | { kind: "llm"; agentId: string; hasPlan: boolean; systemPrompt: string; userContent: string };

/** Step 1 — reads only. Decides whether the model needs to be called. */
export async function prepareEvaluation(meetingId: string, userId: string): Promise<EvaluationJob> {
  const [meeting] = await db
    .select({ agentId: meetings.agentId, transcript: meetings.transcriptUrl })
    .from(meetings)
    .where(meetingScope(meetingId, userId));
  if (!meeting) return { kind: "gone" };

  const items = parseTranscriptItems(meeting.transcript);
  if (items.length === 0) return { kind: "static", report: NO_ITEMS_REPORT };

  // New interviews have a question plan; older ones are evaluated from the transcript.
  const plan = await loadPlan(meetingId);
  if (plan.length === TOTAL_QUESTIONS) {
    const answers = mapAnswersToPlan(items, meeting.agentId, plan.length);
    const hasRealAnswers = [...answers.values()].some((a) => a !== NO_ANSWER && a.trim().length > 0);
    if (!hasRealAnswers) return { kind: "static", report: NO_ANSWERS_REPORT };
    // The plan prompt and input are built in runEvaluation (evaluatePlanAnswers).
    return { kind: "llm", agentId: meeting.agentId, hasPlan: true, systemPrompt: "", userContent: "" };
  }

  const speakerIds = [...new Set(items.map((i) => i.speaker_id))];
  const dbUsers = await db.select().from(user).where(inArray(user.id, speakerIds));
  const speakerMap = new Map<string, string>();
  dbUsers.forEach((u) => speakerMap.set(u.id, u.name));
  PREDEFINED_AGENTS
    .filter((a) => speakerIds.includes(a.id))
    .forEach((a) => speakerMap.set(a.id, `${a.role} (Interviewer)`));

  const userIds = new Set(dbUsers.map((u) => u.id));
  const hasRealAnswers = items
    .filter((item) => userIds.has(item.speaker_id))
    .some((item) => item.text !== NO_ANSWER && item.text.trim().length > 0);
  if (!hasRealAnswers) return { kind: "static", report: NO_ANSWERS_REPORT };

  const readable = items.map((item) => ({ speaker: speakerMap.get(item.speaker_id) ?? "Unknown", text: item.text }));
  return {
    kind: "llm",
    agentId: meeting.agentId,
    hasPlan: false,
    systemPrompt: SYSTEM_PROMPT,
    userContent: "Here is the session transcript:\n\n" + JSON.stringify(readable, null, 2),
  };
}

export type EvaluationResult = {
  report: InterviewReport;
  /** [position, score] pairs; score null = unanswered. Only with a plan. */
  planScores: [number, number | null][] | null;
};

/** Step 2 — calls the model. Returns null if the account was deleted meanwhile. */
export async function runEvaluation(
  meetingId: string,
  userId: string,
  job: Extract<EvaluationJob, { kind: "llm" }>,
): Promise<EvaluationResult | null> {
  // Never send transcript data to the provider for a deleted account.
  const [meeting] = await db
    .select({ agentId: meetings.agentId, transcript: meetings.transcriptUrl })
    .from(meetings)
    .where(meetingScope(meetingId, userId));
  if (!meeting) return null;

  if (job.hasPlan) {
    const plan = await loadPlan(meetingId);
    const answers = mapAnswersToPlan(parseTranscriptItems(meeting.transcript), meeting.agentId, plan.length);
    return evaluatePlanAnswers(plan, answers);
  }

  // Interviews started before question plans existed: free-form transcript.
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const completion = await openai.chat.completions.create({
    model: AI_MODELS.evaluation,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: job.systemPrompt },
      { role: "user", content: job.userContent },
    ],
  });

  // A malformed report throws here, so the step is retried.
  const report = JSON.parse(completion.choices[0]?.message.content ?? "") as InterviewReport;
  if (!report || typeof report.summary !== "string" || !Array.isArray(report.questions)) {
    throw new Error("Evaluation report is missing required fields");
  }
  return { report, planScores: null };
}

/**
 * Step 3 — streak, achievements and topic progress, applied in ONE
 * transaction together with meetings.rewards_applied_at. If that marker is
 * already set (a retried run), nothing is applied again.
 */
export async function applyRewards(
  meetingId: string,
  userId: string,
  agentId: string,
  result: EvaluationResult,
): Promise<"applied" | "already_applied" | "gone"> {
  const [meeting] = await db
    .select({ rewardsAppliedAt: meetings.rewardsAppliedAt, startedAt: meetings.startedAt, endedAt: meetings.endedAt })
    .from(meetings)
    .where(meetingScope(meetingId, userId));
  if (!meeting) return "gone";
  if (meeting.rewardsAppliedAt) return "already_applied";

  // The streak counts the day the interview took place, not the day it was
  // evaluated (a retried evaluation may run days later).
  const practiceDate = localDate(meeting.startedAt ?? meeting.endedAt ?? new Date());
  const achievements = await buildAchievementWrites(userId, agentId, result.report, practiceDate);
  const planWrites = result.planScores
    ? buildPlanResultWrites(userId, await loadPlan(meetingId), new Map(result.planScores))
    : [];
  const marker = db
    .update(meetings)
    .set({ rewardsAppliedAt: new Date() })
    .where(and(meetingScope(meetingId, userId), isNull(meetings.rewardsAppliedAt)));

  await db.batch([marker, ...achievements.writes, ...planWrites]);
  return "applied";
}

/** Step 4 — corrections for the vocabulary notebook. Replaces any previous ones for this meeting. */
export async function saveCorrections(meetingId: string, userId: string, report: InterviewReport) {
  if (!(await meetingExists(meetingId, userId))) return 0;

  const entries = (report.questions ?? []).flatMap((q) =>
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

  const clear = db.delete(corrections).where(eq(corrections.meetingId, meetingId));
  if (entries.length === 0) {
    await clear;
  } else {
    await db.batch([clear, db.insert(corrections).values(entries)]);
  }
  return entries.length;
}

/** Last step — stores the report and completes the meeting. */
export async function saveReport(meetingId: string, userId: string, report: InterviewReport) {
  const updated = await db
    .update(meetings)
    .set({ summary: JSON.stringify(report), status: "completed", updatedAt: new Date() })
    .where(and(meetingScope(meetingId, userId), eq(meetings.status, "processing")))
    .returning({ id: meetings.id });
  return updated.length > 0;
}

/** onFailure — the job ran out of retries; the user can retry from the report page. */
export async function markEvaluationFailed(meetingId: string) {
  await db
    .update(meetings)
    .set({ status: "failed", updatedAt: new Date() })
    .where(and(eq(meetings.id, meetingId), eq(meetings.status, "processing")));
}

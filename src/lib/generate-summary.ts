import OpenAI from "openai";
import { db } from "@/db";
import { meetings, user, corrections } from "@/db/schema";
import { PREDEFINED_AGENTS } from "@/lib/predefined-agents";
import { and, eq, inArray, isNull } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify";
import { buildAchievementWrites } from "@/lib/award-achievements";
import { AI_MODELS } from "@/lib/ai-models";
import { getTopicTitle } from "@/lib/interview-topics";
import { NO_ANSWER, TOTAL_QUESTIONS } from "@/modules/call/constants";
import { buildPlanResultWrites, loadPlan, mapAnswersToPlan, type StoredQuestion } from "@/modules/call/server/plan";
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
    return {
      kind: "llm",
      agentId: meeting.agentId,
      hasPlan: true,
      systemPrompt: `${SYSTEM_PROMPT}\n\n${PLAN_RULES}`,
      userContent:
        "Here is the interview plan with the candidate's answers:\n\n" +
        JSON.stringify(buildPlanInput(plan, answers), null, 2),
    };
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
  if (!(await meetingExists(meetingId, userId))) return null;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const completion = await openai.chat.completions.create({
    model: AI_MODELS.evaluation,
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

  if (!job.hasPlan) return { report, planScores: null };

  // With a plan, the per-question scores are the source of truth: unanswered
  // questions are fixed at 1 and the overall technical score is their average.
  const [meeting] = await db.select({ agentId: meetings.agentId, transcript: meetings.transcriptUrl })
    .from(meetings).where(meetingScope(meetingId, userId));
  if (!meeting) return null;
  const plan = await loadPlan(meetingId);
  const answers = mapAnswersToPlan(parseTranscriptItems(meeting.transcript), meeting.agentId, plan.length);
  const scores = scoresFromReport(plan, answers, report);

  plan.forEach((q, index) => {
    const fb = report.questions.find((r) => r.position === q.position) ?? report.questions[index];
    const score = scores.get(q.position);
    if (fb && score !== undefined) fb.technicalScore = score ?? 1;
  });
  const overall = overallTechnicalScore(plan.map((q) => ({ kind: q.kind, score: scores.get(q.position) })));
  if (overall !== null && report.scores?.technicalKnowledge) {
    report.scores.technicalKnowledge.score = overall;
  }

  return { report, planScores: [...scores.entries()] };
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
    .select({ rewardsAppliedAt: meetings.rewardsAppliedAt })
    .from(meetings)
    .where(meetingScope(meetingId, userId));
  if (!meeting) return "gone";
  if (meeting.rewardsAppliedAt) return "already_applied";

  const achievements = await buildAchievementWrites(userId, agentId, result.report);
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

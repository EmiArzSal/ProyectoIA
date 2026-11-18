// Deterministic scores derived from the evaluator's evidence, so the headline
// numbers always agree with the question breakdown instead of being an
// independent (and sometimes contradictory) guess by the model.

export type QuestionScore = {
  kind: string;               // "technical" | "soft"
  /** 1–5; null = unanswered; undefined = the evaluator gave no score. */
  score: number | null | undefined;
};

/**
 * Average (1–5) of the questions of one kind, rounded to the nearest whole
 * point (x.5 rounds up). Unanswered questions count as 1, the same score they
 * get individually. Questions without a score are ignored. Null when there is
 * nothing to average.
 */
export function overallScore(questions: QuestionScore[], kind: "technical" | "soft"): number | null {
  const values = questions
    .filter((q) => q.kind === kind && q.score !== undefined)
    .map((q) => q.score ?? 1);

  if (values.length === 0) return null;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.min(5, Math.max(1, Math.round(avg)));
}

/** Overall technical knowledge (1–5). */
export const overallTechnicalScore = (questions: QuestionScore[]) => overallScore(questions, "technical");

// ── English level (CEFR) ──────────────────────────────────────────────────────

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Below this many real answers there is not enough evidence for a level. */
export const MIN_ANSWERS_FOR_LEVEL = 4;

/** Fixed mapping so a dimension's 1–5 score always agrees with its level. */
export function cefrToScore(level: CefrLevel): number {
  return { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 5 }[level];
}

/** Median level; with an even count, the lower of the two middle levels. */
export function medianCefr(levels: CefrLevel[]): CefrLevel {
  const sorted = [...levels].sort((a, b) => CEFR_LEVELS.indexOf(a) - CEFR_LEVELS.indexOf(b));
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/** Overall level: median of grammar, vocabulary and fluency, or N/A without enough evidence. */
export function overallEnglishLevel(dimensions: CefrLevel[], realAnswers: number): CefrLevel | "N/A" {
  if (realAnswers < MIN_ANSWERS_FOR_LEVEL || dimensions.length === 0) return "N/A";
  return medianCefr(dimensions);
}

// ── Soft skills (STAR) ────────────────────────────────────────────────────────

export type Star = { situation: boolean; task: boolean; action: boolean; result: boolean };

/** 0 elements → 1, 1 → 2, 2 → 3, 3 → 4, all 4 → 5. */
export function starScore(star: Star): number {
  const present = [star.situation, star.task, star.action, star.result].filter(Boolean).length;
  return present + 1;
}

// ── Annotated answer ──────────────────────────────────────────────────────────

export type Segment<A> = { text: string; annotation: A | null };

/**
 * Rebuilds the annotated answer over the REAL answer text: annotated
 * fragments are located in the answer, in order; fragments that cannot be
 * found are dropped, and the text between them becomes plain segments. The
 * result always concatenates exactly to `answer`, so the highlighted errors
 * are always things the candidate actually said.
 */
export function rebuildSegments<A>(answer: string, segments: Segment<A>[]): Segment<A>[] {
  const out: Segment<A>[] = [];
  const lower = answer.toLowerCase();
  let cursor = 0;

  for (const seg of segments) {
    const needle = seg.text.trim();
    if (!seg.annotation || !needle) continue;

    let idx = answer.indexOf(needle, cursor);
    if (idx < 0) idx = lower.indexOf(needle.toLowerCase(), cursor);
    if (idx < 0) continue;

    if (idx > cursor) out.push({ text: answer.slice(cursor, idx), annotation: null });
    out.push({ text: answer.slice(idx, idx + needle.length), annotation: seg.annotation });
    cursor = idx + needle.length;
  }

  if (cursor < answer.length) out.push({ text: answer.slice(cursor), annotation: null });
  return out;
}

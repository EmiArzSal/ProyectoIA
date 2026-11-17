// Deterministic scores derived from the per-question evaluation, so the
// headline numbers always agree with the question breakdown instead of being
// an independent (and sometimes contradictory) guess by the model.

export type QuestionScore = {
  kind: string;               // "technical" | "soft"
  /** 1–5; null = unanswered; undefined = the evaluator gave no score. */
  score: number | null | undefined;
};

/**
 * Overall technical knowledge (1–5): average of the technical questions,
 * rounded to the nearest whole point (x.5 rounds up). Unanswered questions
 * count as 1, the same score the evaluator gives them. Questions without a
 * score are ignored. Returns null when there is nothing to average.
 */
export function overallTechnicalScore(questions: QuestionScore[]): number | null {
  const values = questions
    .filter((q) => q.kind === "technical" && q.score !== undefined)
    .map((q) => q.score ?? 1);

  if (values.length === 0) return null;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.min(5, Math.max(1, Math.round(avg)));
}

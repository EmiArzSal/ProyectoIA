// The evaluation report is stored whole in meetings.report (jsonb) and its
// headline numbers are copied to plain columns (english_level, *_score), so
// progress queries can filter, sort and average them in SQL.
//
// "No evidence" is stored as null, never as 0 or "N/A": reports without
// answers use score 0 and level "N/A"/"—", and those must not drag averages
// down or show up as a level. Pure; tested in report-columns.test.ts.

import type { InterviewReport } from "./generate-summary";

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const isCefrLevel = (value: unknown): value is CefrLevel =>
  typeof value === "string" && (CEFR_LEVELS as readonly string[]).includes(value);

/** 1 (A1) … 6 (C2), for charts. */
export const cefrRank = (level: CefrLevel) => CEFR_LEVELS.indexOf(level) + 1;

export type ReportColumns = {
  report: InterviewReport;
  englishLevel: CefrLevel | null;
  grammarScore: number | null;
  vocabularyScore: number | null;
  fluencyScore: number | null;
  technicalScore: number | null;
  softSkillsScore: number | null;
};

/** A 1–5 score rounded to one decimal, or null when there was nothing to score. */
function score(dim: { score?: unknown; cefrLevel?: unknown } | undefined, needsLevel = false): number | null {
  const value = dim?.score;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 5) return null;
  if (needsLevel && !isCefrLevel(dim?.cefrLevel)) return null;
  return Math.round(value * 10) / 10;
}

export function reportColumns(report: InterviewReport): ReportColumns {
  const s = report.scores ?? ({} as Partial<InterviewReport["scores"]>);
  return {
    report,
    englishLevel: isCefrLevel(report.englishLevel) ? report.englishLevel : null,
    grammarScore: score(s.grammar, true),
    vocabularyScore: score(s.vocabulary, true),
    fluencyScore: score(s.fluency, true),
    technicalScore: score(s.technicalKnowledge),
    softSkillsScore: score(s.softSkills),
  };
}

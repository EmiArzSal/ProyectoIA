// How the candidate's English level and scores change across evaluated
// interviews. Pure; tested in evolution.test.ts.

import { cefrRank, isCefrLevel, type CefrLevel } from "@/lib/report-columns";

export const SCORE_KEYS = ["grammar", "vocabulary", "fluency", "technical", "softSkills"] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];

export type EvolutionPoint = {
  meetingId: string;
  /** ISO date of the interview. */
  date: string;
  role: string;
  englishLevel: CefrLevel | null;
  scores: Record<ScoreKey, number | null>;
};

export type Trend = { first: number; last: number; change: number };

export type EvolutionSummary = {
  evaluated: number;
  latestLevel: CefrLevel | null;
  bestLevel: CefrLevel | null;
  /** Levels gained (+) or lost (−) from the first interview with a level to the latest. */
  levelChange: number | null;
  /**
   * Average of the first vs. the last interviews (up to 3 each), when there
   * are at least 4 values. The change is between the rounded averages, so it
   * matches the numbers shown.
   */
  trends: Record<ScoreKey, Trend | null>;
};

const TREND_WINDOW = 3;

const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

function trendOf(values: number[]): Trend | null {
  if (values.length < 2 * Math.min(TREND_WINDOW, 2)) return null; // at least 4
  const window = Math.min(TREND_WINDOW, Math.floor(values.length / 2));
  const first = round1(average(values.slice(0, window)));
  const last = round1(average(values.slice(-window)));
  return { first, last, change: round1(last - first) };
}

/** `points` oldest first. */
export function summarizeEvolution(points: EvolutionPoint[]): EvolutionSummary {
  const levels = points.map((p) => p.englishLevel).filter(isCefrLevel);
  const best = levels.reduce<CefrLevel | null>(
    (acc, l) => (acc === null || cefrRank(l) > cefrRank(acc) ? l : acc),
    null,
  );

  const trends = Object.fromEntries(
    SCORE_KEYS.map((key) => [
      key,
      trendOf(points.map((p) => p.scores[key]).filter((v): v is number => v !== null)),
    ]),
  ) as Record<ScoreKey, Trend | null>;

  return {
    evaluated: points.length,
    latestLevel: levels.at(-1) ?? null,
    bestLevel: best,
    levelChange: levels.length >= 2 ? cefrRank(levels.at(-1)!) - cefrRank(levels[0]) : null,
    trends,
  };
}

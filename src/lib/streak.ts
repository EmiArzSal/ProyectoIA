// Practice streak rules. Pure functions (no DB, no clock) so every rule is
// unit-tested in streak.test.ts. Days are calendar days in APP_TIME_ZONE.
import { addDays, localDate, type IsoDate } from "@/lib/dates";

export type StreakStats = {
  currentStreak: number;
  longestStreak: number;
  totalSessions: number;
  lastPracticeDate: IsoDate | null;
};

export const EMPTY_STATS: StreakStats = { currentStreak: 0, longestStreak: 0, totalSessions: 0, lastPracticeDate: null };

/**
 * Stats after one more completed interview practiced on `practiceDate` (the
 * day the interview took place, not the day it was evaluated).
 *
 * - Same day as the last practice → the streak stays.
 * - The day after → the streak grows by one.
 * - Any later day → a new streak of 1.
 * - An EARLIER day (an old interview evaluated late, e.g. after a retry) →
 *   it counts as a session but never moves the streak or the date backwards.
 */
export function computeStreak(prev: StreakStats, practiceDate: IsoDate): StreakStats {
  const totalSessions = prev.totalSessions + 1;
  const last = prev.lastPracticeDate;

  if (last && practiceDate <= last) {
    // Same day, or an older interview. A first session ever still starts at 1.
    const currentStreak = Math.max(prev.currentStreak, 1);
    return {
      currentStreak,
      longestStreak: Math.max(prev.longestStreak, currentStreak),
      totalSessions,
      lastPracticeDate: last,
    };
  }

  const currentStreak = last && addDays(last, 1) === practiceDate ? prev.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(prev.longestStreak, currentStreak),
    totalSessions,
    lastPracticeDate: practiceDate,
  };
}

/**
 * Streak to SHOW today. The stored value is only updated when an interview is
 * evaluated, so after a missed day it is stale: it is still alive if the last
 * practice was today or yesterday, otherwise it is 0. Nothing is written.
 */
export function effectiveStreak(stats: Pick<StreakStats, "currentStreak" | "lastPracticeDate">, now = new Date()): number {
  if (!stats.lastPracticeDate) return 0;
  const today = localDate(now);
  return stats.lastPracticeDate >= addDays(today, -1) ? stats.currentStreak : 0;
}

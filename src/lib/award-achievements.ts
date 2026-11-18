import { db } from "@/db";
import { userStats, userAchievements, meetings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { InterviewReport } from "@/lib/generate-summary";
import type { IsoDate } from "@/lib/dates";
import { computeStreak, EMPTY_STATS } from "@/lib/streak";
import { pickAchievements } from "@/lib/achievement-rules";

/**
 * Computes the streak/session update and new achievements for a finished
 * interview and returns the writes WITHOUT running them, so the caller can
 * apply them atomically together with other writes (see applyRewards in
 * generate-summary.ts). Reads only; nothing is written here.
 *
 * `practiceDate` is the local day the interview took place. `agentId` is this
 * interview's interviewer: it counts toward "all_agents" even though the
 * meeting is marked completed only after the rewards step.
 *
 * Concurrency: the evaluation job runs one at a time per user (see
 * meetings/processing), so this read-then-write cannot interleave with another
 * interview of the same user. The unique (user_id, achievement_id) index plus
 * ON CONFLICT DO NOTHING is the database-level guarantee on top of that.
 */
export async function buildAchievementWrites(
  userId: string,
  agentId: string,
  report: InterviewReport,
  practiceDate: IsoDate,
) {
  const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));
  const next = computeStreak(stats ?? EMPTY_STATS, practiceDate);

  const statsValues = { ...next, updatedAt: new Date() };
  const statsWrite = db
    .insert(userStats)
    .values({ userId, ...statsValues })
    .onConflictDoUpdate({ target: userStats.userId, set: statsValues });

  const earned = await db
    .select({ achievementId: userAchievements.achievementId })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const alreadyEarned = new Set(earned.map((e) => e.achievementId));

  let agentsPracticed = 0;
  if (!alreadyEarned.has("all_agents")) {
    const done = await db
      .selectDistinct({ agentId: meetings.agentId })
      .from(meetings)
      .where(and(eq(meetings.userId, userId), eq(meetings.status, "completed")));
    agentsPracticed = new Set([...done.map((d) => d.agentId), agentId]).size;
  }

  const toAward = pickAchievements({
    stats: next,
    englishLevel: report.englishLevel,
    answers: (report.questions ?? []).map((q) => q.userAnswer),
    agentsPracticed,
    alreadyEarned,
  });

  const achievementsWrite = toAward.length > 0
    ? db
        .insert(userAchievements)
        .values(toAward.map((achievementId) => ({ userId, achievementId, seen: false })))
        .onConflictDoNothing({ target: [userAchievements.userId, userAchievements.achievementId] })
    : null;

  return {
    writes: achievementsWrite ? [statsWrite, achievementsWrite] : [statsWrite],
    awarded: toAward,
  };
}

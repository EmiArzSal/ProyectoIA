import { db } from "@/db";
import { userStats, userAchievements, meetings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { InterviewReport } from "@/lib/generate-summary";

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
const TOTAL_AGENTS = 5;

function todayISO() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function yesterdayISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Computes the streak/session update and new achievements for a finished
 * interview and returns the writes WITHOUT running them, so the caller can
 * apply them atomically together with other writes (see applyRewards in
 * generate-summary.ts). Reads only; nothing is written here.
 *
 * `agentId` is this interview's interviewer: it counts toward "all_agents"
 * even though the meeting is marked completed only after the rewards step.
 */
export async function buildAchievementWrites(
  userId: string,
  agentId: string,
  report: InterviewReport,
) {
  const today = todayISO();
  const yesterday = yesterdayISO();

  const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));
  const current = stats ?? { currentStreak: 0, longestStreak: 0, totalSessions: 0, lastPracticeDate: null };

  // ── Streak ─────────────────────────────────────────────────────────────────
  let newStreak = current.currentStreak;
  if (current.lastPracticeDate === today) {
    // Already practiced today — don't touch the streak
  } else if (current.lastPracticeDate === yesterday) {
    newStreak = current.currentStreak + 1;
  } else {
    newStreak = 1; // Gap — reset
  }
  const newLongest = Math.max(current.longestStreak, newStreak);
  const newTotal   = current.totalSessions + 1;

  const statsValues = {
    currentStreak:    newStreak,
    longestStreak:    newLongest,
    totalSessions:    newTotal,
    lastPracticeDate: today,
    updatedAt:        new Date(),
  };
  const statsWrite = db
    .insert(userStats)
    .values({ userId, ...statsValues })
    .onConflictDoUpdate({ target: userStats.userId, set: statsValues });

  // ── Achievements ───────────────────────────────────────────────────────────
  const earned = await db
    .select({ achievementId: userAchievements.achievementId })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const earnedIds = new Set(earned.map((e) => e.achievementId));

  const toAward: string[] = [];
  const check = (id: string, condition: boolean) => {
    if (condition && !earnedIds.has(id)) toAward.push(id);
  };

  check("first_session", newTotal >= 1);
  check("sessions_5",    newTotal >= 5);
  check("sessions_10",   newTotal >= 10);
  check("sessions_25",   newTotal >= 25);

  check("streak_3",  newStreak >= 3);
  check("streak_7",  newStreak >= 7);
  check("streak_30", newStreak >= 30);

  const levelIdx = CEFR_ORDER.indexOf(report.englishLevel?.toUpperCase());
  check("level_b1", levelIdx >= CEFR_ORDER.indexOf("B1"));
  check("level_b2", levelIdx >= CEFR_ORDER.indexOf("B2"));
  check("level_c1", levelIdx >= CEFR_ORDER.indexOf("C1"));

  // No skips — requires at least one question, and none unanswered.
  const questions = report.questions ?? [];
  check("no_skips", questions.length > 0 && questions.every(
    (q) => q.userAnswer && q.userAnswer !== "(sin respuesta)"
  ));

  if (!earnedIds.has("all_agents")) {
    const done = await db
      .selectDistinct({ agentId: meetings.agentId })
      .from(meetings)
      .where(and(eq(meetings.userId, userId), eq(meetings.status, "completed")));
    const agents = new Set([...done.map((d) => d.agentId), agentId]);
    check("all_agents", agents.size >= TOTAL_AGENTS);
  }

  const achievementsWrite = toAward.length > 0
    ? db.insert(userAchievements).values(toAward.map((achievementId) => ({ userId, achievementId, seen: false })))
    : null;

  return {
    writes: achievementsWrite ? [statsWrite, achievementsWrite] : [statsWrite],
    awarded: toAward,
  };
}

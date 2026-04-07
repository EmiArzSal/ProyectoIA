import { db } from "@/db";
import { userStats, userAchievements, meetings } from "@/db/schema";
import { eq, and, countDistinct } from "drizzle-orm";
import type { InterviewReport } from "@/lib/generate-summary";

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

function todayISO() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function yesterdayISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function awardAchievements(
  meetingId: string,
  userId: string,
  report: InterviewReport,
): Promise<string[]> {
  const today = todayISO();
  const yesterday = yesterdayISO();

  // ── 1. Get or create user stats ──────────────────────────────────────────
  let [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));

  if (!stats) {
    [stats] = await db
      .insert(userStats)
      .values({ userId, currentStreak: 0, longestStreak: 0, totalSessions: 0 })
      .returning();
  }

  // ── 2. Update streak ────────────────────────────────────────────────────
  let newStreak = stats.currentStreak;

  if (stats.lastPracticeDate === today) {
    // Already practiced today — don't touch streak
  } else if (stats.lastPracticeDate === yesterday) {
    newStreak = stats.currentStreak + 1;
  } else {
    newStreak = 1; // Gap — reset
  }

  const newLongest = Math.max(stats.longestStreak, newStreak);
  const newTotal   = stats.totalSessions + 1;

  await db
    .update(userStats)
    .set({
      currentStreak:    newStreak,
      longestStreak:    newLongest,
      totalSessions:    newTotal,
      lastPracticeDate: today,
      updatedAt:        new Date(),
    })
    .where(eq(userStats.userId, userId));

  // ── 3. Get already earned achievements ──────────────────────────────────
  const earned = await db
    .select({ achievementId: userAchievements.achievementId })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const earnedIds = new Set(earned.map((e) => e.achievementId));

  // ── 4. Check conditions ─────────────────────────────────────────────────
  const toAward: string[] = [];

  const check = (id: string, condition: boolean) => {
    if (condition && !earnedIds.has(id)) toAward.push(id);
  };

  // Sessions
  check("first_session", newTotal >= 1);
  check("sessions_5",    newTotal >= 5);
  check("sessions_10",   newTotal >= 10);
  check("sessions_25",   newTotal >= 25);

  // Streak
  check("streak_3",  newStreak >= 3);
  check("streak_7",  newStreak >= 7);
  check("streak_30", newStreak >= 30);

  // CEFR level
  const level = report.englishLevel?.toUpperCase();
  const levelIdx = CEFR_ORDER.indexOf(level);
  check("level_b1", levelIdx >= CEFR_ORDER.indexOf("B1"));
  check("level_b2", levelIdx >= CEFR_ORDER.indexOf("B2"));
  check("level_c1", levelIdx >= CEFR_ORDER.indexOf("C1"));

  // No skips — none of the questions has "(sin respuesta)" as userAnswer
  const noSkips = report.questions.every(
    (q) => q.userAnswer && q.userAnswer !== "(sin respuesta)"
  );
  check("no_skips", noSkips);

  // All agents — distinct agentIds in completed meetings
  if (!earnedIds.has("all_agents")) {
    const [{ count }] = await db
      .select({ count: countDistinct(meetings.agentId) })
      .from(meetings)
      .where(and(eq(meetings.userId, userId), eq(meetings.status, "completed")));
    check("all_agents", Number(count) >= 5);
  }

  // ── 5. Insert new achievements ──────────────────────────────────────────
  if (toAward.length > 0) {
    await db.insert(userAchievements).values(
      toAward.map((achievementId) => ({ userId, achievementId, seen: false }))
    );
  }

  return toAward;
}

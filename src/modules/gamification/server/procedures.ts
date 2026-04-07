import { db } from "@/db";
import { userStats, userAchievements } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import { ACHIEVEMENTS } from "@/lib/achievements";

export const gamificationRouter = createTRPCRouter({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [stats] = await db
      .select()
      .from(userStats)
      .where(eq(userStats.userId, ctx.auth.user.id));
    return stats ?? { currentStreak: 0, longestStreak: 0, totalSessions: 0, lastPracticeDate: null };
  }),

  getAchievements: protectedProcedure.query(async ({ ctx }) => {
    const earned = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, ctx.auth.user.id));

    const earnedMap = new Map(earned.map((e) => [e.achievementId, e]));

    return ACHIEVEMENTS.map((a) => ({
      ...a,
      earned:   earnedMap.has(a.id),
      seen:     earnedMap.get(a.id)?.seen ?? true,
      earnedAt: earnedMap.get(a.id)?.earnedAt ?? null,
    }));
  }),

  getUnseen: protectedProcedure.query(async ({ ctx }) => {
    const unseen = await db
      .select({ achievementId: userAchievements.achievementId })
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, ctx.auth.user.id),
          eq(userAchievements.seen, false)
        )
      );
    return unseen.map((u) => u.achievementId);
  }),

  markAllSeen: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(userAchievements)
      .set({ seen: true })
      .where(
        and(
          eq(userAchievements.userId, ctx.auth.user.id),
          eq(userAchievements.seen, false)
        )
      );
  }),
});

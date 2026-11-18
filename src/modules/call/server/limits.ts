import "server-only";

import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { startOfToday } from "@/lib/dates";

// Daily interview quotas. Both can be overridden with env vars without a deploy
// of new code (e.g. raise them for a demo day).
const intEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export const MAX_SESSIONS_PER_USER_PER_DAY = intEnv("MAX_SESSIONS_PER_USER_PER_DAY", 2);
export const MAX_SESSIONS_GLOBAL_PER_DAY = intEnv("MAX_SESSIONS_GLOBAL_PER_DAY", 40);

export type DailyUsage = {
  used: number;
  limit: number;
  remaining: number;
  /** The platform-wide daily budget is used up. */
  globalExhausted: boolean;
  /** ISO timestamp of the next reset (local midnight). */
  resetsAt: string;
};

// "Today" is the calendar day in APP_TIME_ZONE (see lib/dates), the same day
// boundary the practice streak uses, so quotas reset at local midnight.

/** Interviews count against the quota when they start (startedAt), finished or not. */
export async function getDailyUsage(userId: string): Promise<DailyUsage> {
  const since = startOfToday();

  const [[mine], [everyone]] = await Promise.all([
    db
      .select({ count: count() })
      .from(meetings)
      .where(and(eq(meetings.userId, userId), gte(meetings.startedAt, since))),
    db
      .select({ count: count() })
      .from(meetings)
      .where(gte(meetings.startedAt, since)),
  ]);

  return {
    used: mine.count,
    limit: MAX_SESSIONS_PER_USER_PER_DAY,
    remaining: Math.max(0, MAX_SESSIONS_PER_USER_PER_DAY - mine.count),
    globalExhausted: everyone.count >= MAX_SESSIONS_GLOBAL_PER_DAY,
    resetsAt: new Date(since.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

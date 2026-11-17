import "server-only";

import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { meetings } from "@/db/schema";

// Daily interview quotas. Both can be overridden with env vars without a deploy
// of new code (e.g. raise them for a demo day).
const intEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export const MAX_SESSIONS_PER_USER_PER_DAY = intEnv("MAX_SESSIONS_PER_USER_PER_DAY", 2);
export const MAX_SESSIONS_GLOBAL_PER_DAY = intEnv("MAX_SESSIONS_GLOBAL_PER_DAY", 40);

// "Today" is the calendar day in Mexico City, so quotas reset at local midnight.
export const LIMITS_TIMEZONE = "America/Mexico_City";

/** Instant of the most recent local midnight in `timeZone`. */
export function startOfToday(timeZone = LIMITS_TIMEZONE, now = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );

  const y = Number(parts.year);
  const m = Number(parts.month) - 1;
  const d = Number(parts.day);
  const localAsUTC = Date.UTC(y, m, d, Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offsetMs = localAsUTC - Math.floor(now.getTime() / 1000) * 1000;

  return new Date(Date.UTC(y, m, d) - offsetMs);
}

export type DailyUsage = {
  used: number;
  limit: number;
  remaining: number;
  /** The platform-wide daily budget is used up. */
  globalExhausted: boolean;
  /** ISO timestamp of the next reset (local midnight). */
  resetsAt: string;
};

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

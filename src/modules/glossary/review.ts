// Spaced repetition for the glossary flashcards, Leitner style: every card
// sits in a box 0–5 and each box waits longer before the card comes back.
//   "again" (No me la sé)  → box 0, due again today
//   "hard"  (Más o menos)  → same box, waits that box's interval (at least a day)
//   "good"  (Me la sé)     → next box, waits the new box's interval
// Cards become due at local midnight (APP_TIME_ZONE), the same day boundary
// as the practice streak. Pure; tested in review.test.ts.

import { APP_TIME_ZONE, startOfToday } from "@/lib/dates";

export const MAX_BOX = 5;
/** Days a card waits in each box (index = box). */
export const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 8, 16] as const;

export type ReviewGrade = "again" | "hard" | "good";
export const REVIEW_GRADES: ReviewGrade[] = ["again", "hard", "good"];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight `days` calendar days after `now` (`now` itself for 0). */
export function dueInDays(now: Date, days: number, timeZone = APP_TIME_ZONE): Date {
  if (days <= 0) return now;
  // Midday of the target day, then its midnight: safe across DST changes.
  const midday = new Date(startOfToday(timeZone, now).getTime() + days * DAY_MS + 12 * 60 * 60 * 1000);
  return startOfToday(timeZone, midday);
}

const clampBox = (box: number) => Math.min(MAX_BOX, Math.max(0, Math.trunc(box)));

export function nextReview(box: number, grade: ReviewGrade, now: Date): { box: number; dueAt: Date } {
  const current = clampBox(box);
  if (grade === "again") return { box: 0, dueAt: now };
  if (grade === "hard") return { box: current, dueAt: dueInDays(now, Math.max(1, BOX_INTERVAL_DAYS[current])) };
  const next = Math.min(MAX_BOX, current + 1);
  return { box: next, dueAt: dueInDays(now, BOX_INTERVAL_DAYS[next]) };
}

export const isDue = (dueAt: Date, now: Date) => dueAt.getTime() <= now.getTime();

/** "Para hoy", "Mañana" or "En N días", in calendar days. */
export function describeDue(dueAt: Date, now: Date, timeZone = APP_TIME_ZONE): string {
  if (isDue(dueAt, now)) return "Para hoy";
  const days = Math.round((startOfToday(timeZone, dueAt).getTime() - startOfToday(timeZone, now).getTime()) / DAY_MS);
  if (days <= 0) return "Para hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

/**
 * How terms are stored: trimmed, single spaces. With the unique index on
 * lower(term), a user cannot save the same term twice (any case or spacing).
 */
export const normalizeTerm = (term: string) => term.trim().replace(/\s+/g, " ");

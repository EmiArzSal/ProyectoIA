// Pure, dependency-free logic for the interview plan: which topics to ask,
// at which level, and how a score changes the user's level. Kept free of DB
// and network code so it can be unit-checked.

import type { TopicLevel } from "@/lib/interview-topics";

export type TopicProgress = {
  topicId: string;
  level: number;
  lastScore: number | null;
  lastPracticedAt: Date | null;
};

type Rng = () => number;

const DAY_MS = 24 * 60 * 60 * 1000;

const clampLevel = (n: number): TopicLevel => (n <= 1 ? 1 : n >= 3 ? 3 : 2) as TopicLevel;

/**
 * Higher = more likely to be asked. Weak topics come back first, then topics
 * never practiced, then the ones not seen for a while; mastered topics still
 * appear sometimes. Random jitter keeps sessions varied.
 */
export function techPriority(p: TopicProgress | undefined, now: Date, rng: Rng): number {
  const jitter = rng() * 0.75;
  if (!p || p.lastScore === null) return 3 + jitter;

  const base = p.lastScore <= 2 ? 4 : p.lastScore === 3 ? 2 : 1;
  const days = p.lastPracticedAt ? (now.getTime() - p.lastPracticedAt.getTime()) / DAY_MS : 30;
  const recency = Math.min(days / 7, 1); // up to +1 after a week without practice
  return base + recency + jitter;
}

/** Soft skills have no levels: favour the ones practiced least recently. */
export function softPriority(p: TopicProgress | undefined, now: Date, rng: Rng): number {
  const jitter = rng() * 0.75;
  if (!p || !p.lastPracticedAt) return 3 + jitter;
  const days = (now.getTime() - p.lastPracticedAt.getTime()) / DAY_MS;
  return Math.min(days / 7, 2) + jitter;
}

export type SelectedTopic = { topicId: string; level: TopicLevel };

export function selectTechTopics(
  topicIds: string[],
  progress: Map<string, TopicProgress>,
  count: number,
  now = new Date(),
  rng: Rng = Math.random,
): SelectedTopic[] {
  return topicIds
    .map((topicId) => ({ topicId, priority: techPriority(progress.get(topicId), now, rng) }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, count)
    .map(({ topicId }) => ({ topicId, level: clampLevel(progress.get(topicId)?.level ?? 1) }))
    // Easier questions first so the interview warms up.
    .sort((a, b) => a.level - b.level);
}

export function selectSoftTopics(
  topicIds: string[],
  progress: Map<string, TopicProgress>,
  count: number,
  now = new Date(),
  rng: Rng = Math.random,
): string[] {
  return topicIds
    .map((topicId) => ({ topicId, priority: softPriority(progress.get(topicId), now, rng) }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, count)
    .map(({ topicId }) => topicId);
}

/**
 * Level for the next time this topic is asked, given the score (1–5) obtained
 * at `askedLevel`. Unanswered questions keep the level.
 */
export function nextLevel(askedLevel: number, score: number | null): TopicLevel {
  if (score === null) return clampLevel(askedLevel);
  if (score >= 4) return clampLevel(askedLevel + 1);
  if (score <= 2) return clampLevel(askedLevel - 1);
  return clampLevel(askedLevel);
}

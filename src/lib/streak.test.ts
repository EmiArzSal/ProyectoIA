import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { addDays, localDate, startOfToday } from "./dates";
import { computeStreak, effectiveStreak, EMPTY_STATS, type StreakStats } from "./streak";
import { pickAchievements } from "./achievement-rules";

const stats = (s: Partial<StreakStats>): StreakStats => ({ ...EMPTY_STATS, ...s });

describe("dates", () => {
  it("uses the Mexico City calendar day, not UTC", () => {
    // 19:00 in Mexico City on Nov 16 is already Nov 17 in UTC.
    assert.equal(localDate(new Date("2026-11-17T01:00:00Z")), "2026-11-16");
    assert.equal(localDate(new Date("2026-11-17T06:00:00Z")), "2026-11-17");
  });

  it("adds days across month and year boundaries", () => {
    assert.equal(addDays("2026-02-28", 1), "2026-03-01");
    assert.equal(addDays("2028-02-28", 1), "2028-02-29");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  });

  it("starts the day at local midnight", () => {
    assert.equal(startOfToday(undefined, new Date("2026-11-17T01:00:00Z")).toISOString(), "2026-11-16T06:00:00.000Z");
  });
});

describe("computeStreak", () => {
  it("starts at 1 for the first session", () => {
    assert.deepEqual(computeStreak(EMPTY_STATS, "2026-11-17"), {
      currentStreak: 1, longestStreak: 1, totalSessions: 1, lastPracticeDate: "2026-11-17",
    });
  });

  it("keeps the streak on the same day", () => {
    const next = computeStreak(stats({ currentStreak: 3, longestStreak: 3, totalSessions: 5, lastPracticeDate: "2026-11-17" }), "2026-11-17");
    assert.equal(next.currentStreak, 3);
    assert.equal(next.totalSessions, 6);
  });

  it("grows on the next day", () => {
    const next = computeStreak(stats({ currentStreak: 3, longestStreak: 3, totalSessions: 5, lastPracticeDate: "2026-11-16" }), "2026-11-17");
    assert.equal(next.currentStreak, 4);
    assert.equal(next.longestStreak, 4);
  });

  it("grows across a month boundary", () => {
    assert.equal(computeStreak(stats({ currentStreak: 2, lastPracticeDate: "2026-11-30" }), "2026-12-01").currentStreak, 3);
  });

  it("resets after a missed day but keeps the longest", () => {
    const next = computeStreak(stats({ currentStreak: 5, longestStreak: 7, totalSessions: 9, lastPracticeDate: "2026-11-14" }), "2026-11-17");
    assert.equal(next.currentStreak, 1);
    assert.equal(next.longestStreak, 7);
  });

  it("never moves backwards for an older interview evaluated late", () => {
    const prev = stats({ currentStreak: 4, longestStreak: 4, totalSessions: 6, lastPracticeDate: "2026-11-17" });
    const next = computeStreak(prev, "2026-11-12");
    assert.equal(next.currentStreak, 4);
    assert.equal(next.lastPracticeDate, "2026-11-17");
    assert.equal(next.totalSessions, 7);
  });
});

describe("effectiveStreak", () => {
  // 2026-11-17 12:00 in Mexico City.
  const now = new Date("2026-11-17T18:00:00Z");

  it("shows the streak when the last practice was today or yesterday", () => {
    assert.equal(effectiveStreak({ currentStreak: 5, lastPracticeDate: "2026-11-17" }, now), 5);
    assert.equal(effectiveStreak({ currentStreak: 5, lastPracticeDate: "2026-11-16" }, now), 5);
  });

  it("shows 0 once a day was missed", () => {
    assert.equal(effectiveStreak({ currentStreak: 5, lastPracticeDate: "2026-11-15" }, now), 0);
    assert.equal(effectiveStreak({ currentStreak: 0, lastPracticeDate: null }, now), 0);
  });
});

describe("pickAchievements", () => {
  const base = {
    stats: stats({ currentStreak: 1, longestStreak: 1, totalSessions: 1, lastPracticeDate: "2026-11-17" }),
    englishLevel: "A2",
    answers: ["Some answer", "(sin respuesta)"],
    agentsPracticed: 1,
    alreadyEarned: new Set<string>(),
  };

  it("does not award again what is already earned", () => {
    assert.deepEqual(pickAchievements(base), ["first_session"]);
    assert.deepEqual(pickAchievements({ ...base, alreadyEarned: new Set(["first_session"]) }), []);
  });

  it("awards level achievements up to the level reached", () => {
    assert.deepEqual(pickAchievements({ ...base, englishLevel: "B2", alreadyEarned: new Set(["first_session"]) }), ["level_b1", "level_b2"]);
  });

  it("awards no level achievement without enough evidence (N/A)", () => {
    const awarded = pickAchievements({ ...base, englishLevel: "N/A" });
    assert.ok(!awarded.some((id) => id.startsWith("level_")));
  });

  it("awards streak achievements from the updated streak", () => {
    assert.ok(pickAchievements({ ...base, stats: stats({ currentStreak: 3, totalSessions: 3 }) }).includes("streak_3"));
  });

  it("requires every question answered for no_skips", () => {
    assert.ok(!pickAchievements(base).includes("no_skips"));
    assert.ok(pickAchievements({ ...base, answers: ["a", "b"] }).includes("no_skips"));
    assert.ok(!pickAchievements({ ...base, answers: [] }).includes("no_skips"));
  });

  it("awards all_agents with the five interviewers", () => {
    assert.ok(pickAchievements({ ...base, agentsPracticed: 5 }).includes("all_agents"));
  });
});

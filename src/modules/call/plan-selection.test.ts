import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { nextLevel, selectSoftTopics, selectTechTopics, type TopicProgress } from "./plan-selection";
import { SOFT_TOPICS, TECH_TOPICS, getTechTopicsForAgent } from "@/lib/interview-topics";
import { PREDEFINED_AGENTS } from "@/lib/predefined-agents";
import { isUsableQuestion } from "./session-rules";
import { TECH_QUESTIONS, TOTAL_QUESTIONS } from "./constants";

const now = new Date("2026-11-17T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const noJitter = () => 0;
const progress = (rows: TopicProgress[]) => new Map(rows.map((r) => [r.topicId, r]));

describe("nextLevel", () => {
  it("goes up with 4+, down with 2-, stays with 3 or no answer, within 1–3", () => {
    assert.equal(nextLevel(1, 4), 2);
    assert.equal(nextLevel(3, 5), 3);
    assert.equal(nextLevel(2, 2), 1);
    assert.equal(nextLevel(1, 1), 1);
    assert.equal(nextLevel(2, 3), 2);
    assert.equal(nextLevel(2, null), 2);
  });
});

describe("selectTechTopics", () => {
  const ids = ["a", "b", "c", "d"];

  it("brings weak topics back first, then new ones, mastered last", () => {
    const p = progress([
      { topicId: "a", level: 3, lastScore: 5, lastPracticedAt: daysAgo(1) }, // mastered
      { topicId: "b", level: 1, lastScore: 1, lastPracticedAt: daysAgo(1) }, // weak
      { topicId: "c", level: 2, lastScore: 3, lastPracticedAt: daysAgo(1) }, // in progress
    ]);
    const picked = selectTechTopics(ids, p, 2, now, noJitter).map((t) => t.topicId);
    assert.deepEqual(new Set(picked), new Set(["b", "d"]));
  });

  it("asks each topic at the user's level, easiest first, without repeats", () => {
    const p = progress([
      { topicId: "a", level: 3, lastScore: 1, lastPracticedAt: daysAgo(2) },
      { topicId: "b", level: 2, lastScore: 1, lastPracticedAt: daysAgo(2) },
    ]);
    const picked = selectTechTopics(ids, p, 4, now, noJitter);
    assert.equal(new Set(picked.map((t) => t.topicId)).size, 4);
    assert.deepEqual(picked.map((t) => t.level), [...picked.map((t) => t.level)].sort());
    assert.equal(picked.find((t) => t.topicId === "a")?.level, 3);
    assert.equal(picked.find((t) => t.topicId === "c")?.level, 1);
  });
});

describe("selectSoftTopics", () => {
  it("prefers topics never practiced or practiced longest ago", () => {
    const p = progress([
      { topicId: "x", level: 1, lastScore: 3, lastPracticedAt: daysAgo(1) },
      { topicId: "y", level: 1, lastScore: 3, lastPracticedAt: daysAgo(10) },
    ]);
    assert.deepEqual(selectSoftTopics(["x", "y", "z"], p, 2, now, noJitter), ["z", "y"]);
  });
});

describe("topic bank", () => {
  it("has enough topics for every interviewer", () => {
    for (const agent of PREDEFINED_AGENTS) {
      assert.ok(getTechTopicsForAgent(agent.id).length >= TECH_QUESTIONS, agent.id);
    }
    assert.ok(SOFT_TOPICS.length >= TOTAL_QUESTIONS - TECH_QUESTIONS);
  });

  it("has unique ids", () => {
    const ids = [...TECH_TOPICS, ...SOFT_TOPICS].map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("has seed questions that pass the same check as generated ones", () => {
    for (const t of TECH_TOPICS) {
      t.seeds.forEach((q, i) => assert.ok(isUsableQuestion(q, [], "technical"), `${t.id} level ${i + 1}: ${q}`));
      assert.ok(t.concepts.length > 0, t.id);
    }
    for (const t of SOFT_TOPICS) assert.ok(isUsableQuestion(t.seed, [], "soft"), `${t.id}: ${t.seed}`);
  });
});

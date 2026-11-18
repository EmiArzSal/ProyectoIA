import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { summarizeEvolution, type EvolutionPoint, type ScoreKey } from "./evolution";

const noScores: Record<ScoreKey, number | null> = { grammar: null, vocabulary: null, fluency: null, technical: null, softSkills: null };

const point = (i: number, level: EvolutionPoint["englishLevel"], scores: Partial<Record<ScoreKey, number | null>> = {}): EvolutionPoint => ({
  meetingId: `m${i}`,
  date: `2026-11-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`,
  role: "Frontend Developer",
  englishLevel: level,
  scores: { ...noScores, ...scores },
});

describe("summarizeEvolution", () => {
  it("is empty without interviews", () => {
    const s = summarizeEvolution([]);
    assert.equal(s.evaluated, 0);
    assert.equal(s.latestLevel, null);
    assert.equal(s.bestLevel, null);
    assert.equal(s.levelChange, null);
    assert.equal(s.trends.grammar, null);
  });

  it("reports the latest and best level and the change since the first", () => {
    const s = summarizeEvolution([point(0, "A2"), point(1, "B2"), point(2, null), point(3, "B1")]);
    assert.equal(s.latestLevel, "B1");
    assert.equal(s.bestLevel, "B2");
    assert.equal(s.levelChange, 1); // A2 → B1
  });

  it("has no level change with a single level", () => {
    assert.equal(summarizeEvolution([point(0, "B1"), point(1, null)]).levelChange, null);
  });

  it("compares the first and last three scores", () => {
    const grammar = [2, 2, 3, 3, 4, 4];
    const s = summarizeEvolution(grammar.map((g, i) => point(i, "B1", { grammar: g })));
    // The change is between the rounded averages, as shown on screen.
    assert.deepEqual(s.trends.grammar, { first: 2.3, last: 3.7, change: 1.4 });
  });

  it("uses smaller windows with few interviews and needs at least four values", () => {
    const four = summarizeEvolution([1, 2, 4, 5].map((v, i) => point(i, null, { fluency: v })));
    assert.deepEqual(four.trends.fluency, { first: 1.5, last: 4.5, change: 3 });
    const three = summarizeEvolution([1, 2, 3].map((v, i) => point(i, null, { fluency: v })));
    assert.equal(three.trends.fluency, null);
  });

  it("skips interviews without that score", () => {
    const s = summarizeEvolution([
      point(0, null, { softSkills: 2 }),
      point(1, null, { softSkills: null }),
      point(2, null, { softSkills: 3 }),
      point(3, null, { softSkills: 4 }),
      point(4, null, { softSkills: 5 }),
    ]);
    assert.deepEqual(s.trends.softSkills, { first: 2.5, last: 4.5, change: 2 });
  });
});

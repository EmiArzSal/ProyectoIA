import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  cefrToScore,
  medianCefr,
  overallEnglishLevel,
  overallScore,
  rebuildSegments,
  starScore,
  type Segment,
} from "./report-scoring";

describe("overallScore", () => {
  it("averages one kind and rounds .5 up", () => {
    const qs = [
      { kind: "technical", score: 4 },
      { kind: "technical", score: 5 },
      { kind: "soft", score: 1 },
    ];
    assert.equal(overallScore(qs, "technical"), 5); // 4.5 → 5
    assert.equal(overallScore(qs, "soft"), 1);
  });

  it("counts unanswered questions (null) as 1", () => {
    assert.equal(overallScore([{ kind: "technical", score: 5 }, { kind: "technical", score: null }], "technical"), 3);
  });

  it("ignores questions without a score and returns null when nothing is left", () => {
    assert.equal(overallScore([{ kind: "technical", score: undefined }, { kind: "technical", score: 2 }], "technical"), 2);
    assert.equal(overallScore([{ kind: "soft", score: 4 }], "technical"), null);
  });
});

describe("English level", () => {
  it("maps CEFR to a fixed 1–5 score", () => {
    assert.deepEqual(["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => cefrToScore(l as never)), [1, 2, 3, 4, 5, 5]);
  });

  it("takes the median, and the lower middle level with an even count", () => {
    assert.equal(medianCefr(["B2", "A2", "B1"]), "B1");
    assert.equal(medianCefr(["B2", "B1"]), "B1");
    assert.equal(medianCefr(["C1"]), "C1");
  });

  it("is N/A with fewer than 4 real answers", () => {
    assert.equal(overallEnglishLevel(["B2", "B2", "B2"], 3), "N/A");
    assert.equal(overallEnglishLevel(["B2", "B2", "B2"], 4), "B2");
    assert.equal(overallEnglishLevel([], 10), "N/A");
  });
});

describe("starScore", () => {
  it("is 1 + the number of STAR elements present", () => {
    const f = false, t = true;
    assert.equal(starScore({ situation: f, task: f, action: f, result: f }), 1);
    assert.equal(starScore({ situation: t, task: f, action: t, result: f }), 3);
    assert.equal(starScore({ situation: t, task: t, action: t, result: t }), 5);
  });
});

describe("rebuildSegments", () => {
  const note = { corrected: "x" };
  const join = (segs: Segment<unknown>[]) => segs.map((s) => s.text).join("");

  it("highlights fragments in place and keeps the rest as plain text", () => {
    const answer = "I has a project in React.";
    const out = rebuildSegments(answer, [{ text: "I has", annotation: note }]);
    assert.deepEqual(out, [
      { text: "I has", annotation: note },
      { text: " a project in React.", annotation: null },
    ]);
  });

  it("matches case-insensitively but keeps the candidate's own text", () => {
    const out = rebuildSegments("i has a project", [{ text: "I has", annotation: note }]);
    assert.equal(out[0].text, "i has");
    assert.equal(out[0].annotation, note);
  });

  it("drops fragments the candidate never said", () => {
    const out = rebuildSegments("Hello world", [{ text: "goodbye", annotation: note }]);
    assert.deepEqual(out, [{ text: "Hello world", annotation: null }]);
  });

  it("drops out-of-order fragments instead of overlapping", () => {
    const out = rebuildSegments("one two three", [
      { text: "three", annotation: note },
      { text: "one", annotation: note },
    ]);
    assert.equal(join(out), "one two three");
    assert.equal(out.filter((s) => s.annotation).length, 1);
  });

  it("always rebuilds exactly the original answer (randomized)", () => {
    let seed = 42;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
    const words = ["I", "has", "worked", "with", "React", "the", "API", "is", "fast", "a", "an"];
    for (let run = 0; run < 500; run++) {
      const answer = Array.from({ length: 1 + Math.floor(rand() * 15) }, () => words[Math.floor(rand() * words.length)]).join(" ");
      const segments = Array.from({ length: Math.floor(rand() * 5) }, () => {
        const len = 1 + Math.floor(rand() * 3);
        const start = Math.floor(rand() * words.length);
        const text = words.slice(start, start + len).join(" ");
        return { text: rand() < 0.3 ? text.toUpperCase() : text, annotation: rand() < 0.8 ? note : null };
      });
      const out = rebuildSegments(answer, segments);
      assert.equal(join(out), answer, `run ${run}`);
      for (const s of out) if (s.annotation) assert.ok(answer.includes(s.text));
    }
  });
});

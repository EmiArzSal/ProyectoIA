import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { InterviewReport } from "./generate-summary";
import { cefrRank, readReport, reportColumns } from "./report-columns";

const report = (over: Partial<InterviewReport> = {}, scores: Partial<InterviewReport["scores"]> = {}): InterviewReport => ({
  summary: "Resumen.",
  englishLevel: "B1",
  scores: {
    grammar:            { score: 3, cefrLevel: "B1", notes: "" },
    vocabulary:         { score: 4, cefrLevel: "B2", notes: "" },
    fluency:            { score: 2, cefrLevel: "A2", notes: "" },
    technicalKnowledge: { score: 3.67, notes: "" },
    softSkills:         { score: 4, notes: "" },
    ...scores,
  },
  questions: [],
  overallStrengths: [],
  overallImprovements: [],
  recommendation: "",
  ...over,
});

describe("reportColumns", () => {
  it("copies the level and the five scores", () => {
    const r = report();
    assert.deepEqual(reportColumns(r), {
      report: r,
      englishLevel: "B1",
      grammarScore: 3,
      vocabularyScore: 4,
      fluencyScore: 2,
      technicalScore: 3.7,
      softSkillsScore: 4,
    });
  });

  it("stores no level and no scores for an interview without answers", () => {
    const empty = report({ englishLevel: "N/A" }, {
      grammar:            { score: 0, cefrLevel: "N/A", notes: "" },
      vocabulary:         { score: 0, cefrLevel: "N/A", notes: "" },
      fluency:            { score: 0, cefrLevel: "N/A", notes: "" },
      technicalKnowledge: { score: 0, notes: "" },
      softSkills:         undefined,
    });
    const cols = reportColumns(empty);
    assert.equal(cols.englishLevel, null);
    for (const key of ["grammarScore", "vocabularyScore", "fluencyScore", "technicalScore", "softSkillsScore"] as const) {
      assert.equal(cols[key], null, key);
    }
  });

  it("ignores an English score without a CEFR level and anything out of range", () => {
    const cols = reportColumns(report({ englishLevel: "—" }, {
      grammar:            { score: 3, cefrLevel: "—", notes: "" },
      technicalKnowledge: { score: 7, notes: "" },
    }));
    assert.equal(cols.englishLevel, null);
    assert.equal(cols.grammarScore, null);
    assert.equal(cols.technicalScore, null);
    assert.equal(cols.vocabularyScore, 4);
  });

  it("handles reports from before soft skills were scored", () => {
    assert.equal(reportColumns(report({}, { softSkills: undefined })).softSkillsScore, null);
  });
});

describe("readReport", () => {
  const r = report();

  it("prefers the jsonb column", () => {
    assert.equal(readReport({ report: r, summary: "{broken" }), r);
  });

  it("falls back to the old text column", () => {
    assert.deepEqual(readReport({ report: null, summary: JSON.stringify(r) }), r);
  });

  it("returns null without a report or with broken text", () => {
    assert.equal(readReport({ report: null, summary: null }), null);
    assert.equal(readReport({ summary: "{broken" }), null);
  });
});

describe("cefrRank", () => {
  it("orders the levels", () => {
    assert.equal(cefrRank("A1"), 1);
    assert.equal(cefrRank("C2"), 6);
  });
});

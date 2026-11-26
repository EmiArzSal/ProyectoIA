import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildChecklist, type OnboardingSignals } from "./steps";

const none: OnboardingSignals = {
  startedInterview: false,
  receivedReport: false,
  correctionCard: false,
  reviewedCard: false,
  savedWord: false,
};

describe("buildChecklist", () => {
  it("starts with nothing done and suggests the first interview", () => {
    const c = buildChecklist(none, false);
    assert.equal(c.total, 5);
    assert.equal(c.completed, 0);
    assert.equal(c.finished, false);
    assert.equal(c.next, "startedInterview");
    assert.equal(c.visible, true);
  });

  it("marks steps from the signals and suggests the first one pending", () => {
    const c = buildChecklist({ ...none, startedInterview: true, receivedReport: true, savedWord: true }, false);
    assert.equal(c.completed, 3);
    assert.deepEqual(c.steps.filter((s) => s.done).map((s) => s.id), ["startedInterview", "receivedReport", "savedWord"]);
    assert.equal(c.next, "correctionCard");
  });

  it("allows steps in any order", () => {
    const c = buildChecklist({ ...none, reviewedCard: true }, false);
    assert.equal(c.completed, 1);
    assert.equal(c.next, "startedInterview");
  });

  it("is finished when every step is done", () => {
    const all = Object.fromEntries(Object.keys(none).map((k) => [k, true])) as OnboardingSignals;
    const c = buildChecklist(all, false);
    assert.equal(c.finished, true);
    assert.equal(c.next, null);
    assert.equal(c.visible, true); // shows the "finished" card until acknowledged
  });

  it("hides the card once dismissed, finished or not", () => {
    assert.equal(buildChecklist(none, true).visible, false);
  });

  it("keeps the order and links of the steps", () => {
    const c = buildChecklist(none, false);
    assert.deepEqual(c.steps.map((s) => s.href), ["/agentes", "/meetings", "/corrections", "/glossary", "/glossary?tab=dictionary"]);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDue, dueInDays, isDue, MAX_BOX, nextReview, normalizeTerm } from "./review";

// 2026-11-18 15:00 in Mexico City (UTC−6).
const now = new Date("2026-11-18T21:00:00Z");
// Local midnight of 2026-11-19, 2026-11-20…
const midnight = (day: number) => new Date(`2026-11-${day}T06:00:00Z`);

describe("dueInDays", () => {
  it("is due right away for 0 days", () => {
    assert.equal(dueInDays(now, 0).getTime(), now.getTime());
  });

  it("is due at local midnight, not 24 h later", () => {
    assert.equal(dueInDays(now, 1).toISOString(), midnight(19).toISOString());
    assert.equal(dueInDays(now, 4).toISOString(), midnight(22).toISOString());
  });

  it("uses the local day even when it is already tomorrow in UTC", () => {
    const lateEvening = new Date("2026-11-19T04:30:00Z"); // 22:30 on Nov 18 locally
    assert.equal(dueInDays(lateEvening, 1).toISOString(), midnight(19).toISOString());
  });

  it("crosses months", () => {
    assert.equal(dueInDays(new Date("2026-11-30T18:00:00Z"), 2).toISOString(), "2026-12-02T06:00:00.000Z");
  });
});

describe("nextReview", () => {
  it("sends a forgotten card back to box 0, due today", () => {
    assert.deepEqual(nextReview(4, "again", now), { box: 0, dueAt: now });
  });

  it("keeps the box on 'hard' and waits its interval, at least a day", () => {
    assert.deepEqual(nextReview(0, "hard", now), { box: 0, dueAt: midnight(19) });
    assert.deepEqual(nextReview(3, "hard", now), { box: 3, dueAt: midnight(22) });
  });

  it("moves up a box on 'good' and waits the new box's interval", () => {
    assert.deepEqual(nextReview(0, "good", now), { box: 1, dueAt: midnight(19) });
    assert.deepEqual(nextReview(2, "good", now), { box: 3, dueAt: midnight(22) });
  });

  it("never goes past the last box", () => {
    const r = nextReview(MAX_BOX, "good", now);
    assert.equal(r.box, MAX_BOX);
    assert.equal(r.dueAt.toISOString(), "2026-12-04T06:00:00.000Z"); // 16 days
  });

  it("tolerates out-of-range boxes", () => {
    assert.equal(nextReview(-3, "good", now).box, 1);
    assert.equal(nextReview(99, "hard", now).box, MAX_BOX);
  });
});

describe("describeDue", () => {
  it("labels by calendar day", () => {
    assert.equal(describeDue(now, now), "Para hoy");
    assert.equal(describeDue(new Date("2026-01-01T00:00:00Z"), now), "Para hoy");
    assert.equal(describeDue(midnight(19), now), "Mañana");
    assert.equal(describeDue(midnight(22), now), "En 4 días");
  });

  it("isDue compares instants", () => {
    assert.equal(isDue(now, now), true);
    assert.equal(isDue(midnight(19), now), false);
  });
});

describe("normalizeTerm", () => {
  it("trims and collapses spaces", () => {
    assert.equal(normalizeTerm("  Virtual   DOM \n"), "Virtual DOM");
  });
});

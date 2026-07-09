import { describe, expect, it } from "vitest";

import {
  CEFR_MASTERY_LABELS,
  CEFR_MASTERY_LEVELS,
  computeCefrMasteryBreakdown,
  formatCefrMasterySegmentLabel,
  type CefrMasteryCard,
} from "@/lib/deck/cefr-mastery-breakdown";

function card(
  cefr: CefrMasteryCard["cefr"],
  fsrsState: number,
  suspended = false,
): CefrMasteryCard {
  return { cefr, fsrsState, suspended };
}

/** Fixed deck used to assert exact per-level mastery counts. */
const FIXTURE: CefrMasteryCard[] = [
  card("A1", 0),
  card("A1", 0),
  card("A1", 1),
  card("A2", 2),
  card("A2", 2),
  card("A2", 2),
  card("A2", 3),
  card("B1", 1),
  card("B2", 0, true),
  card("C1", 2),
  card("C2", 3),
];

describe("computeCefrMasteryBreakdown", () => {
  it("returns a row for every CEFR level in order", () => {
    const rows = computeCefrMasteryBreakdown([]);
    expect(rows.map((r) => r.level)).toEqual([...CEFR_MASTERY_LEVELS]);
  });

  it("maps the fixture deck to known per-level mastery counts", () => {
    const rows = computeCefrMasteryBreakdown(FIXTURE);
    const byLevel = Object.fromEntries(rows.map((r) => [r.level, r.counts]));

    expect(byLevel.A1).toEqual({ new: 2, learning: 1, review: 0, relearning: 0 });
    expect(byLevel.A2).toEqual({ new: 0, learning: 0, review: 3, relearning: 1 });
    expect(byLevel.B1).toEqual({ new: 0, learning: 1, review: 0, relearning: 0 });
    expect(byLevel.B2).toEqual({ new: 0, learning: 0, review: 0, relearning: 0 });
    expect(byLevel.C1).toEqual({ new: 0, learning: 0, review: 1, relearning: 0 });
    expect(byLevel.C2).toEqual({ new: 0, learning: 0, review: 0, relearning: 1 });
  });

  it("computes row totals from mastery buckets", () => {
    const rows = computeCefrMasteryBreakdown(FIXTURE);
    for (const row of rows) {
      const sum = CEFR_MASTERY_LABELS.reduce((acc, label) => acc + row.counts[label], 0);
      expect(row.total).toBe(sum);
    }
    expect(rows.find((r) => r.level === "A2")?.total).toBe(4);
  });

  it("excludes suspended cards", () => {
    const rows = computeCefrMasteryBreakdown(FIXTURE);
    expect(rows.find((r) => r.level === "B2")?.total).toBe(0);
  });

  it("returns zero counts for an empty deck", () => {
    const rows = computeCefrMasteryBreakdown([]);
    expect(rows.every((r) => r.total === 0)).toBe(true);
  });
});

describe("formatCefrMasterySegmentLabel", () => {
  it("returns empty for zero count", () => {
    expect(formatCefrMasterySegmentLabel("A1", "new", 0)).toBe("");
  });

  it("formats a non-zero segment", () => {
    expect(formatCefrMasterySegmentLabel("B2", "review", 3)).toBe("B2 · Review: 3 cards");
    expect(formatCefrMasterySegmentLabel("C1", "relearning", 1)).toBe("C1 · Relearning: 1 card");
  });
});

import { describe, expect, it } from "vitest";

import type { Unit } from "@/lib/db";
import { groupUnitsByChapter } from "@/lib/path/chapters";

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    index: 0,
    title: "Unit 1",
    teacherNote: "note",
    targetGrammarIds: ["simple_present"],
    targetVocab: [],
    targetCefr: "A1",
    activities: [{ skill: "review" }],
    status: "available",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

describe("groupUnitsByChapter", () => {
  it("returns an empty list for an empty path", () => {
    expect(groupUnitsByChapter([])).toEqual([]);
  });

  it("groups consecutive same-level units into one chapter", () => {
    const units = [
      unit({ id: 1, index: 0, targetCefr: "A1" }),
      unit({ id: 2, index: 1, targetCefr: "A1" }),
      unit({ id: 3, index: 2, targetCefr: "A2" }),
    ];

    const chapters = groupUnitsByChapter(units);

    expect(chapters).toHaveLength(2);
    expect(chapters[0]?.cefr).toBe("A1");
    expect(chapters[0]?.units.map((u) => u.id)).toEqual([1, 2]);
    expect(chapters[1]?.cefr).toBe("A2");
    expect(chapters[1]?.units.map((u) => u.id)).toEqual([3]);
  });

  it("preserves given order rather than re-sorting by CEFR level", () => {
    // Not a realistic backbone shape, but the grouping itself must stay a stable single pass —
    // it trusts the caller's ordering rather than imposing its own.
    const units = [
      unit({ id: 1, index: 0, targetCefr: "B1" }),
      unit({ id: 2, index: 1, targetCefr: "A1" }),
    ];

    const chapters = groupUnitsByChapter(units);

    expect(chapters.map((c) => c.cefr)).toEqual(["B1", "A1"]);
  });

  it("marks a chapter complete only once every one of its units is completed", () => {
    const units = [
      unit({ id: 1, index: 0, targetCefr: "A1", status: "completed" }),
      unit({ id: 2, index: 1, targetCefr: "A1", status: "in-progress" }),
    ];

    expect(groupUnitsByChapter(units)[0]?.isComplete).toBe(false);
  });

  it("marks a chapter complete when every unit in it is completed", () => {
    const units = [
      unit({ id: 1, index: 0, targetCefr: "A1", status: "completed" }),
      unit({ id: 2, index: 1, targetCefr: "A1", status: "completed" }),
      unit({ id: 3, index: 2, targetCefr: "A2", status: "locked" }),
    ];

    const chapters = groupUnitsByChapter(units);

    expect(chapters[0]?.isComplete).toBe(true);
    expect(chapters[1]?.isComplete).toBe(false);
  });
});

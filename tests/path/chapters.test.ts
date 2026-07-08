import { describe, expect, it } from "vitest";

import type { Unit } from "@/lib/db";
import { groupUnitsByChapter, chapterTierCompletedByUnit } from "@/lib/path/chapters";

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
    expect(chapters[0]?.tier).toBe("A1");
    expect(chapters[0]?.units.map((u) => u.id)).toEqual([1, 2]);
    expect(chapters[1]?.tier).toBe("A2");
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

    expect(chapters.map((c) => c.tier)).toEqual(["B1", "A1"]);
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

  it("groups negative-index pre-A1 units into their own chapter", () => {
    const units = [
      unit({ id: 1, index: -2, targetCefr: "A1", status: "available" }),
      unit({ id: 2, index: -1, targetCefr: "A1", status: "locked" }),
      unit({ id: 3, index: 0, targetCefr: "A1", status: "locked" }),
    ];

    const chapters = groupUnitsByChapter(units);

    expect(chapters.map((c) => c.tier)).toEqual(["pre-A1", "A1"]);
    expect(chapters[0]?.units.map((u) => u.id)).toEqual([1, 2]);
  });
});

describe("chapterTierCompletedByUnit", () => {
  it("returns the tier when the completed unit is the last one in a now-complete chapter", () => {
    const units = [
      unit({ id: 1, index: 0, targetCefr: "A1", status: "completed" }),
      unit({ id: 2, index: 1, targetCefr: "A1", status: "completed" }),
      unit({ id: 3, index: 2, targetCefr: "A2", status: "locked" }),
    ];

    expect(chapterTierCompletedByUnit(units, 2)).toBe("A1");
  });

  it("returns null when the unit is not the final unit of its chapter", () => {
    const units = [
      unit({ id: 1, index: 0, targetCefr: "A1", status: "completed" }),
      unit({ id: 2, index: 1, targetCefr: "A1", status: "in-progress" }),
    ];

    expect(chapterTierCompletedByUnit(units, 1)).toBeNull();
  });

  it("returns null when the chapter is not yet fully complete", () => {
    const units = [
      unit({ id: 1, index: 0, targetCefr: "A1", status: "completed" }),
      unit({ id: 2, index: 1, targetCefr: "A1", status: "in-progress" }),
    ];

    expect(chapterTierCompletedByUnit(units, 2)).toBeNull();
  });
});

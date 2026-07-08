import { describe, expect, it } from "vitest";

import type { Unit, UnitActivityRef } from "@/lib/db";
import {
  completeActivity,
  currentUnit,
  firstPendingActivityIndex,
  isUnitComplete,
  nextUnitToUnlock,
} from "@/lib/path/unit-progress";

function activity(overrides: Partial<UnitActivityRef> = {}): UnitActivityRef {
  return { skill: "review", ...overrides };
}

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    index: 0,
    title: "Unit 1",
    teacherNote: "note",
    targetGrammarIds: ["simple_present"],
    targetVocab: [],
    targetCefr: "A1",
    activities: [activity({ skill: "review" }), activity({ skill: "reading" })],
    status: "available",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

describe("firstPendingActivityIndex", () => {
  it("returns 0 when no activity is done", () => {
    expect(firstPendingActivityIndex(unit())).toBe(0);
  });

  it("returns the index of the first not-done activity after a partial completion", () => {
    const u = unit({ activities: [activity({ done: true }), activity({ skill: "reading" })] });
    expect(firstPendingActivityIndex(u)).toBe(1);
  });

  it("returns activities.length when every activity is done", () => {
    const u = unit({
      activities: [activity({ done: true }), activity({ skill: "reading", done: true })],
    });
    expect(firstPendingActivityIndex(u)).toBe(2);
  });

  it("returns 0 for a unit with no activities (degenerate case)", () => {
    expect(firstPendingActivityIndex(unit({ activities: [] }))).toBe(0);
  });
});

describe("isUnitComplete", () => {
  it("is false when no activities are done", () => {
    expect(isUnitComplete(unit())).toBe(false);
  });

  it("is false when only some activities are done", () => {
    const u = unit({ activities: [activity({ done: true }), activity({ skill: "reading" })] });
    expect(isUnitComplete(u)).toBe(false);
  });

  it("is true when every activity is done", () => {
    const u = unit({
      activities: [activity({ done: true }), activity({ skill: "reading", done: true })],
    });
    expect(isUnitComplete(u)).toBe(true);
  });

  it("is false for a unit with no activities", () => {
    expect(isUnitComplete(unit({ activities: [] }))).toBe(false);
  });
});

describe("completeActivity", () => {
  it("marks the activity at the given index done, leaving the others untouched", () => {
    const { activities } = completeActivity(unit(), 0);
    expect(activities[0]).toEqual({ skill: "review", done: true });
    expect(activities[1]).toEqual({ skill: "reading" });
  });

  it("transitions status to in-progress on the first (non-final) completion", () => {
    const { status } = completeActivity(unit({ status: "available" }), 0);
    expect(status).toBe("in-progress");
  });

  it("transitions status to completed once the final activity is done", () => {
    const u = unit({
      status: "in-progress",
      activities: [activity({ done: true }), activity({ skill: "reading" })],
    });
    const { status, activities } = completeActivity(u, 1);
    expect(status).toBe("completed");
    expect(activities.every((a) => a.done)).toBe(true);
  });

  it("does not mutate the input unit's activities array", () => {
    const u = unit();
    const before = JSON.stringify(u.activities);
    completeActivity(u, 0);
    expect(JSON.stringify(u.activities)).toBe(before);
  });
});

describe("nextUnitToUnlock", () => {
  it("returns the next unit when it exists and is locked", () => {
    const completed = unit({ id: 1, index: 0 });
    const next = unit({ id: 2, index: 1, status: "locked" });
    expect(nextUnitToUnlock([completed, next], completed)).toBe(next);
  });

  it("returns null when there is no next unit (end of path)", () => {
    const completed = unit({ id: 1, index: 0 });
    expect(nextUnitToUnlock([completed], completed)).toBeNull();
  });

  it("returns null when the next unit is already unlocked", () => {
    const completed = unit({ id: 1, index: 0 });
    const next = unit({ id: 2, index: 1, status: "available" });
    expect(nextUnitToUnlock([completed, next], completed)).toBeNull();
  });

  it("unlocks unit 0 after the last pre-A1 unit completes", () => {
    const completed = unit({ id: 4, index: -1, status: "completed" });
    const next = unit({ id: 5, index: 0, status: "locked" });
    expect(nextUnitToUnlock([completed, next], completed)).toBe(next);
  });
});

describe("currentUnit", () => {
  it("prefers an in-progress unit over an available one", () => {
    const inProgress = unit({ id: 1, index: 0, status: "in-progress" });
    const available = unit({ id: 2, index: 1, status: "available" });
    expect(currentUnit([inProgress, available])).toBe(inProgress);
  });

  it("falls back to the next available unit when nothing is in progress", () => {
    const completed = unit({ id: 1, index: 0, status: "completed" });
    const available = unit({ id: 2, index: 1, status: "available" });
    expect(currentUnit([completed, available])).toBe(available);
  });

  it("returns null when every unit is locked or completed (nothing to resume)", () => {
    const completed = unit({ id: 1, index: 0, status: "completed" });
    const locked = unit({ id: 2, index: 1, status: "locked" });
    expect(currentUnit([completed, locked])).toBeNull();
  });

  it("returns null for an empty path", () => {
    expect(currentUnit([])).toBeNull();
  });
});

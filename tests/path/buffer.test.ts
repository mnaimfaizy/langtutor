import { describe, expect, it } from "vitest";

import type { Unit, UnitActivityRef } from "@/lib/db";
import {
  computeUnitBufferStatus,
  currentPlayableUnit,
  decideReplenishment,
  isActivityReady,
  isPathPaused,
  nextActivityNeedsGeneration,
  PATH_BUFFER_DEPTH,
} from "@/lib/path/buffer";

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

// ── isActivityReady ────────────────────────────────────────────────────────────

describe("isActivityReady", () => {
  it("review is always ready — it needs no generated content", () => {
    expect(isActivityReady(activity({ skill: "review" }))).toBe(true);
  });

  it("alphabet is always ready — it uses the media store, not generated content", () => {
    expect(isActivityReady(activity({ skill: "alphabet" }))).toBe(true);
  });

  it("phonics is always ready — it uses the media store, not generated content", () => {
    expect(isActivityReady(activity({ skill: "phonics" }))).toBe(true);
  });

  it("listen-tap is always ready — it uses the media store, not generated content", () => {
    expect(isActivityReady(activity({ skill: "listen-tap" }))).toBe(true);
  });

  it("a non-review activity without a contentId is not ready", () => {
    expect(isActivityReady(activity({ skill: "reading" }))).toBe(false);
  });

  it("a non-review activity with a contentId is ready", () => {
    expect(isActivityReady(activity({ skill: "reading", contentId: 42 }))).toBe(true);
  });
});

// ── computeUnitBufferStatus ─────────────────────────────────────────────────────

describe("computeUnitBufferStatus", () => {
  it("is empty for an unplanned backbone placeholder (no targetVocab)", () => {
    const u = unit({ targetVocab: [] });
    expect(computeUnitBufferStatus(u)).toBe("empty");
  });

  it("is empty when planned but content generation hasn't happened yet", () => {
    const u = unit({
      targetVocab: ["now"],
      activities: [activity({ skill: "review" }), activity({ skill: "reading" })],
    });
    expect(computeUnitBufferStatus(u)).toBe("empty");
  });

  it("is empty when only some activities are generated (partial buffer)", () => {
    const u = unit({
      targetVocab: ["now"],
      activities: [
        activity({ skill: "review" }),
        activity({ skill: "reading", contentId: 1 }),
        activity({ skill: "writing" }),
      ],
    });
    expect(computeUnitBufferStatus(u)).toBe("empty");
  });

  it("is buffered once planned and every activity is ready", () => {
    const u = unit({
      targetVocab: ["now"],
      activities: [
        activity({ skill: "review" }),
        activity({ skill: "reading", contentId: 1 }),
        activity({ skill: "writing", contentId: 2 }),
      ],
    });
    expect(computeUnitBufferStatus(u)).toBe("buffered");
  });

  it("is buffered for a planned unit whose only activity is review", () => {
    const u = unit({ targetVocab: ["now"], activities: [activity({ skill: "review" })] });
    expect(computeUnitBufferStatus(u)).toBe("buffered");
  });
});

// ── decideReplenishment ──────────────────────────────────────────────────────────

describe("decideReplenishment", () => {
  it("plans an unplanned future unit within the depth window", () => {
    const units = [unit({ id: 1, index: 0, status: "available", targetVocab: [] })];
    const plan = decideReplenishment(units);
    expect(plan.toPlan.map((u) => u.id)).toEqual([1]);
    expect(plan.toGenerateContent).toEqual([]);
  });

  it("generates content for a planned-but-not-buffered future unit", () => {
    const units = [
      unit({
        id: 1,
        index: 0,
        status: "available",
        targetVocab: ["now"],
        activities: [activity({ skill: "review" }), activity({ skill: "reading" })],
      }),
    ];
    const plan = decideReplenishment(units);
    expect(plan.toPlan).toEqual([]);
    expect(plan.toGenerateContent.map((u) => u.id)).toEqual([1]);
  });

  it("does nothing for a unit that's already fully buffered", () => {
    const units = [
      unit({
        id: 1,
        index: 0,
        status: "available",
        targetVocab: ["now"],
        activities: [activity({ skill: "review", contentId: undefined })],
      }),
    ];
    const plan = decideReplenishment(units);
    expect(plan.toPlan).toEqual([]);
    expect(plan.toGenerateContent).toEqual([]);
  });

  it("ignores completed and in-progress units — the buffer only looks ahead", () => {
    const units = [
      unit({ id: 1, index: 0, status: "completed", targetVocab: [] }),
      unit({ id: 2, index: 1, status: "in-progress", targetVocab: [] }),
    ];
    const plan = decideReplenishment(units);
    expect(plan.toPlan).toEqual([]);
    expect(plan.toGenerateContent).toEqual([]);
  });

  it("caps the window at the given depth, in path order", () => {
    const units = Array.from({ length: 5 }, (_, i) =>
      unit({ id: i, index: i, status: i === 0 ? "available" : "locked", targetVocab: [] }),
    );
    const plan = decideReplenishment(units, 2);
    expect(plan.toPlan.map((u) => u.id)).toEqual([0, 1]);
  });

  it("defaults to PATH_BUFFER_DEPTH when no depth is given", () => {
    const units = Array.from({ length: PATH_BUFFER_DEPTH + 5 }, (_, i) =>
      unit({ id: i, index: i, status: i === 0 ? "available" : "locked", targetVocab: [] }),
    );
    const plan = decideReplenishment(units);
    expect(plan.toPlan).toHaveLength(PATH_BUFFER_DEPTH);
  });

  it("a depth of 0 replenishes nothing", () => {
    const units = [unit({ id: 1, index: 0, status: "available", targetVocab: [] })];
    const plan = decideReplenishment(units, 0);
    expect(plan.toPlan).toEqual([]);
    expect(plan.toGenerateContent).toEqual([]);
  });

  it("handles a mixed window: some units need planning, others need content", () => {
    const units = [
      unit({ id: 1, index: 0, status: "available", targetVocab: [] }),
      unit({
        id: 2,
        index: 1,
        status: "locked",
        targetVocab: ["now"],
        activities: [activity({ skill: "writing" })],
      }),
      unit({
        id: 3,
        index: 2,
        status: "locked",
        targetVocab: ["now"],
        activities: [activity({ skill: "writing", contentId: 7 })],
      }),
    ];
    const plan = decideReplenishment(units, 3);
    expect(plan.toPlan.map((u) => u.id)).toEqual([1]);
    expect(plan.toGenerateContent.map((u) => u.id)).toEqual([2]);
  });
});

// ── currentPlayableUnit / nextActivityNeedsGeneration / isPathPaused ────────────

describe("currentPlayableUnit", () => {
  it("prefers the in-progress unit over the available one", () => {
    const inProgress = unit({ id: 1, index: 0, status: "in-progress" });
    const available = unit({ id: 2, index: 1, status: "available" });
    expect(currentPlayableUnit([inProgress, available])).toBe(inProgress);
  });

  it("falls back to the available unit when nothing is in progress", () => {
    const available = unit({ id: 1, index: 0, status: "available" });
    expect(currentPlayableUnit([available])).toBe(available);
  });

  it("returns undefined when there's no in-progress or available unit", () => {
    const locked = unit({ id: 1, index: 0, status: "locked" });
    expect(currentPlayableUnit([locked])).toBeUndefined();
  });
});

describe("nextActivityNeedsGeneration", () => {
  it("is false when the next pending activity is review", () => {
    const u = unit({ activities: [activity({ skill: "review" })] });
    expect(nextActivityNeedsGeneration(u)).toBe(false);
  });

  it("is true when the next pending activity has no contentId yet", () => {
    const u = unit({ activities: [activity({ skill: "reading" })] });
    expect(nextActivityNeedsGeneration(u)).toBe(true);
  });

  it("is false when the next pending activity is already generated", () => {
    const u = unit({ activities: [activity({ skill: "reading", contentId: 5 })] });
    expect(nextActivityNeedsGeneration(u)).toBe(false);
  });

  it("is false when every activity is already done", () => {
    const u = unit({ activities: [activity({ skill: "reading", contentId: 5, done: true })] });
    expect(nextActivityNeedsGeneration(u)).toBe(false);
  });
});

describe("isPathPaused", () => {
  it("never pauses while the provider is reachable", () => {
    const u = unit({ activities: [activity({ skill: "reading" })] });
    expect(isPathPaused(u, true)).toBe(false);
  });

  it("never pauses when there's no current unit", () => {
    expect(isPathPaused(undefined, false)).toBe(false);
  });

  it("pauses when unreachable and the next activity needs generation", () => {
    const u = unit({ activities: [activity({ skill: "reading" })] });
    expect(isPathPaused(u, false)).toBe(true);
  });

  it("does not pause when unreachable but the next activity is already buffered", () => {
    const u = unit({ activities: [activity({ skill: "reading", contentId: 5 })] });
    expect(isPathPaused(u, false)).toBe(false);
  });

  it("does not pause when unreachable but the next activity is review", () => {
    const u = unit({ activities: [activity({ skill: "review" })] });
    expect(isPathPaused(u, false)).toBe(false);
  });
});

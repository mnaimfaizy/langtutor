import { describe, expect, it } from "vitest";

import type { Profile, Unit, UnitActivityRef } from "@/lib/db";
import {
  effectiveProgressionMode,
  isA1BlockedByPreA1Gate,
  isPreA1ChapterComplete,
  resolveChapterGateStatus,
  shouldHoldUnlockForChapterGate,
  shouldShowPreA1ChapterGatePendingCta,
} from "@/lib/path/chapter-gate";

function activity(overrides: Partial<UnitActivityRef> = {}): UnitActivityRef {
  return { skill: "review", ...overrides };
}

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    index: 0,
    title: "Unit",
    teacherNote: "note",
    targetGrammarIds: [],
    targetVocab: [],
    targetCefr: "A1",
    activities: [activity()],
    status: "available",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: {},
    ...overrides,
  };
}

describe("effectiveProgressionMode", () => {
  it("defaults adults to strict when unset", () => {
    expect(effectiveProgressionMode(profile({ experienceMode: "adult" }))).toBe("strict");
  });

  it("honours an adult open setting", () => {
    expect(
      effectiveProgressionMode(
        profile({ experienceMode: "adult", settings: { progressionMode: "open" } }),
      ),
    ).toBe("open");
  });

  it("forces strict for kid accounts even when settings say open", () => {
    expect(
      effectiveProgressionMode(
        profile({ experienceMode: "kid", settings: { progressionMode: "open" } }),
      ),
    ).toBe("strict");
  });
});

describe("resolveChapterGateStatus", () => {
  it("treats a missing row as pending", () => {
    expect(resolveChapterGateStatus(undefined)).toBe("pending");
  });

  it("returns the stored status", () => {
    expect(resolveChapterGateStatus({ status: "passed" })).toBe("passed");
  });
});

describe("shouldHoldUnlockForChapterGate", () => {
  const lastPreA1 = unit({ id: 4, index: -1, status: "completed" });
  const unit0 = unit({ id: 5, index: 0, status: "locked" });

  it("holds pre-A1 → A1 unlock in strict when the gate is pending", () => {
    expect(
      shouldHoldUnlockForChapterGate({
        completedUnit: lastPreA1,
        nextUnit: unit0,
        progressionMode: "strict",
        gateStatus: "pending",
      }),
    ).toBe(true);
  });

  it("does not hold when the gate is passed", () => {
    expect(
      shouldHoldUnlockForChapterGate({
        completedUnit: lastPreA1,
        nextUnit: unit0,
        progressionMode: "strict",
        gateStatus: "passed",
      }),
    ).toBe(false);
  });

  it("does not hold in open mode", () => {
    expect(
      shouldHoldUnlockForChapterGate({
        completedUnit: lastPreA1,
        nextUnit: unit0,
        progressionMode: "open",
        gateStatus: "pending",
      }),
    ).toBe(false);
  });

  it("does not hold within-pre-A1 unlocks", () => {
    expect(
      shouldHoldUnlockForChapterGate({
        completedUnit: unit({ id: 1, index: -4, status: "completed" }),
        nextUnit: unit({ id: 2, index: -3, status: "locked" }),
        progressionMode: "strict",
        gateStatus: "pending",
      }),
    ).toBe(false);
  });
});

describe("pre-A1 chapter complete + CTA + A1 block", () => {
  const completedPreA1 = [-4, -3, -2, -1].map((index, i) =>
    unit({ id: i + 1, index, status: "completed" }),
  );
  const lockedA1 = unit({ id: 10, index: 0, status: "locked" });

  it("isPreA1ChapterComplete requires every pre-A1 unit done", () => {
    expect(isPreA1ChapterComplete([...completedPreA1, lockedA1])).toBe(true);
    expect(
      isPreA1ChapterComplete([
        unit({ id: 1, index: -4, status: "completed" }),
        unit({ id: 2, index: -3, status: "available" }),
        lockedA1,
      ]),
    ).toBe(false);
    expect(isPreA1ChapterComplete([lockedA1])).toBe(false);
  });

  it("shows the pending CTA when pre-A1 is done and the gate is not passed", () => {
    expect(
      shouldShowPreA1ChapterGatePendingCta({
        units: [...completedPreA1, lockedA1],
        gateStatus: "pending",
      }),
    ).toBe(true);
    expect(
      shouldShowPreA1ChapterGatePendingCta({
        units: [...completedPreA1, lockedA1],
        gateStatus: "passed",
      }),
    ).toBe(false);
  });

  it("blocks A1 only in strict mode while the gate is pending", () => {
    expect(
      isA1BlockedByPreA1Gate({
        profile: profile({ experienceMode: "kid" }),
        units: [...completedPreA1, lockedA1],
        gateStatus: "pending",
      }),
    ).toBe(true);
    expect(
      isA1BlockedByPreA1Gate({
        profile: profile({
          experienceMode: "adult",
          settings: { progressionMode: "open", enablePreA1: true },
        }),
        units: [...completedPreA1, lockedA1],
        gateStatus: "pending",
      }),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import type { Profile, SharedPathStage, Unit, UnitActivityRef } from "@/lib/db";
import { PRE_A1_STAGE_IDS } from "@/lib/db";
import {
  arePreA1StagesReadyForExam,
  effectiveProgressionMode,
  isA1BlockedByPreA1Gate,
  isPreA1ChapterComplete,
  resolveChapterGateStatus,
  resolveStagesReadyForExam,
  shouldHoldUnlockForChapterGate,
  shouldShowPreA1ChapterGatePendingCta,
  shouldShowPreA1ChapterGrowingState,
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

function stagesWithReady(
  readyIds: readonly string[],
): Pick<SharedPathStage, "id" | "readyForExam">[] {
  return PRE_A1_STAGE_IDS.map((id) => ({
    id,
    readyForExam: readyIds.includes(id),
  }));
}

const allReady = (): boolean => arePreA1StagesReadyForExam(stagesWithReady([...PRE_A1_STAGE_IDS]));
const starterReady = (): boolean => arePreA1StagesReadyForExam(stagesWithReady(["alphabet"]));

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

describe("arePreA1StagesReadyForExam (issue #128)", () => {
  it("is false when the catalog is empty", () => {
    expect(arePreA1StagesReadyForExam([])).toBe(false);
  });

  it("is false when only Alphabet is marked ready (starter seed)", () => {
    expect(starterReady()).toBe(false);
  });

  it("is false when any required stage is not ready", () => {
    expect(
      arePreA1StagesReadyForExam(stagesWithReady(["alphabet", "phonics", "picture-words"])),
    ).toBe(false);
  });

  it("is true only when all four stages are ready", () => {
    expect(allReady()).toBe(true);
  });
});

describe("resolveStagesReadyForExam (issue #130)", () => {
  it("grandfathers learners who already have a gate row", () => {
    expect(resolveStagesReadyForExam([], { status: "pending" })).toBe(true);
    expect(resolveStagesReadyForExam([], { status: "passed" })).toBe(true);
  });

  it("defers to the shared enrichment bar when no gate exists yet", () => {
    expect(resolveStagesReadyForExam([], undefined)).toBe(false);
    expect(resolveStagesReadyForExam(stagesWithReady([...PRE_A1_STAGE_IDS]), undefined)).toBe(true);
  });
});

describe("shouldHoldUnlockForChapterGate", () => {
  const lastPreA1 = unit({ id: 4, index: -1, status: "completed" });
  const unit0 = unit({ id: 5, index: 0, status: "locked" });

  it("holds pre-A1 → A1 unlock in strict when the gate is pending and stages are ready", () => {
    expect(
      shouldHoldUnlockForChapterGate({
        completedUnit: lastPreA1,
        nextUnit: unit0,
        progressionMode: "strict",
        gateStatus: "pending",
        stagesReadyForExam: true,
      }),
    ).toBe(true);
  });

  it("holds even in open mode when stages are not exam-ready", () => {
    expect(
      shouldHoldUnlockForChapterGate({
        completedUnit: lastPreA1,
        nextUnit: unit0,
        progressionMode: "open",
        gateStatus: "pending",
        stagesReadyForExam: false,
      }),
    ).toBe(true);
  });

  it("does not hold when the gate is passed and stages are ready", () => {
    expect(
      shouldHoldUnlockForChapterGate({
        completedUnit: lastPreA1,
        nextUnit: unit0,
        progressionMode: "strict",
        gateStatus: "passed",
        stagesReadyForExam: true,
      }),
    ).toBe(false);
  });

  it("holds when stages become unready even if a stale gate is passed", () => {
    expect(
      shouldHoldUnlockForChapterGate({
        completedUnit: lastPreA1,
        nextUnit: unit0,
        progressionMode: "strict",
        gateStatus: "passed",
        stagesReadyForExam: false,
      }),
    ).toBe(true);
  });

  it("does not hold in open mode once stages are ready", () => {
    expect(
      shouldHoldUnlockForChapterGate({
        completedUnit: lastPreA1,
        nextUnit: unit0,
        progressionMode: "open",
        gateStatus: "pending",
        stagesReadyForExam: true,
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
        stagesReadyForExam: false,
      }),
    ).toBe(false);
  });
});

describe("pre-A1 chapter complete + CTA + growing + A1 block (issue #128)", () => {
  const completedPreA1 = [-4, -3, -2, -1].map((index, i) =>
    unit({ id: i + 1, index, status: "completed" }),
  );
  const lockedA1 = unit({ id: 10, index: 0, status: "locked" });
  const units = [...completedPreA1, lockedA1];

  it("isPreA1ChapterComplete requires every pre-A1 unit done", () => {
    expect(isPreA1ChapterComplete(units)).toBe(true);
    expect(
      isPreA1ChapterComplete([
        unit({ id: 1, index: -4, status: "completed" }),
        unit({ id: 2, index: -3, status: "available" }),
        lockedA1,
      ]),
    ).toBe(false);
    expect(isPreA1ChapterComplete([lockedA1])).toBe(false);
  });

  it("does not offer the exam CTA when stages are not ready (placeholders alone)", () => {
    expect(
      shouldShowPreA1ChapterGatePendingCta({
        units,
        gateStatus: "pending",
        stagesReadyForExam: false,
      }),
    ).toBe(false);
  });

  it("shows the growing state when complete but stages are not ready", () => {
    expect(
      shouldShowPreA1ChapterGrowingState({
        units,
        gateStatus: "pending",
        stagesReadyForExam: false,
      }),
    ).toBe(true);
    expect(
      shouldShowPreA1ChapterGrowingState({
        units,
        gateStatus: "pending",
        stagesReadyForExam: true,
      }),
    ).toBe(false);
    expect(
      shouldShowPreA1ChapterGrowingState({
        units,
        gateStatus: "passed",
        stagesReadyForExam: false,
      }),
    ).toBe(false);
  });

  it("shows the pending CTA when stages are ready and the gate is not passed", () => {
    expect(
      shouldShowPreA1ChapterGatePendingCta({
        units,
        gateStatus: "pending",
        stagesReadyForExam: true,
      }),
    ).toBe(true);
    expect(
      shouldShowPreA1ChapterGatePendingCta({
        units,
        gateStatus: "passed",
        stagesReadyForExam: true,
      }),
    ).toBe(false);
  });

  it("blocks A1 while stages are not ready (open and strict)", () => {
    expect(
      isA1BlockedByPreA1Gate({
        profile: profile({
          experienceMode: "adult",
          settings: { progressionMode: "open", enablePreA1: true },
        }),
        units,
        gateStatus: "pending",
        stagesReadyForExam: false,
      }),
    ).toBe(true);
    expect(
      isA1BlockedByPreA1Gate({
        profile: profile({ experienceMode: "kid" }),
        units,
        gateStatus: "pending",
        stagesReadyForExam: false,
      }),
    ).toBe(true);
  });

  it("blocks A1 only in strict mode once stages are ready and the gate is pending", () => {
    expect(
      isA1BlockedByPreA1Gate({
        profile: profile({ experienceMode: "kid" }),
        units,
        gateStatus: "pending",
        stagesReadyForExam: true,
      }),
    ).toBe(true);
    expect(
      isA1BlockedByPreA1Gate({
        profile: profile({ experienceMode: "kid" }),
        units,
        gateStatus: "failed_review",
        stagesReadyForExam: true,
      }),
    ).toBe(true);
    expect(
      isA1BlockedByPreA1Gate({
        profile: profile({ experienceMode: "kid" }),
        units,
        gateStatus: "ready_retake",
        stagesReadyForExam: true,
      }),
    ).toBe(true);
    expect(
      isA1BlockedByPreA1Gate({
        profile: profile({
          experienceMode: "adult",
          settings: { progressionMode: "open", enablePreA1: true },
        }),
        units,
        gateStatus: "pending",
        stagesReadyForExam: true,
      }),
    ).toBe(false);
  });
});

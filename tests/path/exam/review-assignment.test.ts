import { describe, expect, it } from "vitest";

import type { ChapterGate, ContentRepository, NewContent, NewUnit, Profile, Unit } from "@/lib/db";
import {
  PRE_A1_SKILL_TO_UNIT_INDEX,
  buildPreA1ReviewAssignment,
  isPreA1ExamStartAllowed,
  isReviewAssignmentComplete,
  markPreA1ReviewItemDone,
  selectReviewSkills,
  submitPreA1ChapterExam,
} from "@/lib/path/exam";
import { scorePreA1Exam } from "@/lib/path/exam/scoring";
import { isA1BlockedByPreA1Gate } from "@/lib/path/chapter-gate";

import { allCorrectAnswers, allWrongAnswers, makeValidExamFill } from "./fixtures";

type FakeRepo = ContentRepository & {
  getSavedGate: (tier: string) => ChapterGate | undefined;
  getUnit0: () => Unit | undefined;
};

function makeFakeRepo(units: Unit[], profile?: Profile): FakeRepo {
  const state = {
    units: units.slice(),
    chapterGates: new Map<string, ChapterGate>(),
    putContents: [] as NewContent[],
    contentId: 1,
    profile,
  };
  return {
    getSavedGate(tier: string) {
      return state.chapterGates.get(tier);
    },
    getUnit0() {
      return state.units.find((u) => u.index === 0);
    },
    async getUnits() {
      return state.units;
    },
    async updateUnit(id: number, changes: Partial<NewUnit>) {
      const idx = state.units.findIndex((u) => u.id === id);
      if (idx === -1) return;
      state.units[idx] = { ...state.units[idx]!, ...changes };
    },
    async getChapterGate(tier: string) {
      return state.chapterGates.get(tier);
    },
    async saveChapterGate(gate: ChapterGate) {
      state.chapterGates.set(gate.tier, gate);
    },
    async putContent(content: NewContent) {
      state.putContents.push(content);
      return state.contentId++;
    },
    async getProfile(): Promise<Profile | undefined> {
      return state.profile;
    },
  } as unknown as FakeRepo;
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
    activities: [{ skill: "review" }],
    status: "locked",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

function kidProfile(): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: {},
    experienceMode: "kid",
  };
}

function openAdultProfile(): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: { progressionMode: "open", enablePreA1: true },
    experienceMode: "adult",
  };
}

const completedPreA1 = [-4, -3, -2, -1].map((index, i) =>
  unit({ id: i + 1, index, status: "completed" }),
);

describe("selectReviewSkills / buildPreA1ReviewAssignment", () => {
  it("assigns concrete units/skills for sections below the floor", () => {
    const fill = makeValidExamFill();
    // Fail alphabet + phonics floors; pass the rest enough to still fail overall.
    const answers = fill.items.map((item) => {
      if (item.skill === "alphabet" || item.skill === "phonics") return (item.answerIndex + 1) % 4;
      return item.answerIndex;
    });
    const breakdown = scorePreA1Exam(fill, answers);
    const skills = selectReviewSkills(breakdown);
    expect(skills).toContain("alphabet");
    expect(skills).toContain("phonics");

    const assignment = buildPreA1ReviewAssignment({
      breakdown,
      attemptContentId: 9,
      now: new Date("2026-07-11T12:00:00.000Z"),
    });
    expect(assignment.items.length).toBeGreaterThanOrEqual(1);
    expect(assignment.items.every((i) => i.done === false)).toBe(true);
    expect(assignment.items.find((i) => i.skill === "alphabet")?.unitIndex).toBe(
      PRE_A1_SKILL_TO_UNIT_INDEX.alphabet,
    );
    expect(assignment.attemptContentId).toBe(9);
  });

  it("merges teacher focusSkills into the assignment", () => {
    const fill = makeValidExamFill();
    const breakdown = scorePreA1Exam(fill, allWrongAnswers(fill));
    const assignment = buildPreA1ReviewAssignment({
      breakdown,
      focusSkills: ["listen-tap"],
    });
    expect(assignment.items.some((i) => i.skill === "listen-tap")).toBe(true);
  });
});

describe("strict fail → review → retake → pass state machine (issue #117)", () => {
  it("on strict fail keeps A1 locked and assigns a trackable review", async () => {
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
      kidProfile(),
    );
    const fill = makeValidExamFill();
    const result = await submitPreA1ChapterExam(repo, fill, allWrongAnswers(fill));

    expect(result.breakdown.passed).toBe(false);
    expect(result.unlockedA1).toBe(false);
    expect(result.reviewAssigned).toBe(true);
    expect(result.reviewAssignment?.items.length).toBeGreaterThanOrEqual(1);

    const gate = repo.getSavedGate("pre-A1");
    expect(gate?.status).toBe("failed_review");
    expect(gate?.reviewAssignment?.items.every((i) => !i.done)).toBe(true);
    expect(repo.getUnit0()?.status).toBe("locked");
    expect(isPreA1ExamStartAllowed(gate?.status)).toBe(false);
    expect(
      isA1BlockedByPreA1Gate({
        profile: kidProfile(),
        units: [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
        gateStatus: "failed_review",
        stagesReadyForExam: true,
      }),
    ).toBe(true);
  });

  it("blocks retake until every review item is done, then offers ready_retake", async () => {
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
      kidProfile(),
    );
    const fill = makeValidExamFill();
    await submitPreA1ChapterExam(repo, fill, allWrongAnswers(fill));

    const gate = repo.getSavedGate("pre-A1")!;
    const first = gate.reviewAssignment!.items[0]!;
    const afterFirst = await markPreA1ReviewItemDone(repo, first.id);
    expect(afterFirst?.status).toBe(
      gate.reviewAssignment!.items.length === 1 ? "ready_retake" : "failed_review",
    );

    for (const item of gate.reviewAssignment!.items.slice(1)) {
      await markPreA1ReviewItemDone(repo, item.id);
    }

    const ready = repo.getSavedGate("pre-A1");
    expect(ready?.status).toBe("ready_retake");
    expect(isReviewAssignmentComplete(ready?.reviewAssignment)).toBe(true);
    expect(isPreA1ExamStartAllowed(ready?.status)).toBe(true);
    expect(repo.getUnit0()?.status).toBe("locked");
  });

  it("completing review alone never unlocks A1", async () => {
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
      kidProfile(),
    );
    const fill = makeValidExamFill();
    await submitPreA1ChapterExam(repo, fill, allWrongAnswers(fill));
    const items = repo.getSavedGate("pre-A1")!.reviewAssignment!.items;
    for (const item of items) {
      await markPreA1ReviewItemDone(repo, item.id);
    }
    expect(repo.getSavedGate("pre-A1")?.status).toBe("ready_retake");
    expect(repo.getUnit0()?.status).toBe("locked");
  });

  it("pass on retake unlocks A1 and clears the review assignment", async () => {
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
      kidProfile(),
    );
    const fill = makeValidExamFill();
    await submitPreA1ChapterExam(repo, fill, allWrongAnswers(fill));
    for (const item of repo.getSavedGate("pre-A1")!.reviewAssignment!.items) {
      await markPreA1ReviewItemDone(repo, item.id);
    }
    expect(repo.getSavedGate("pre-A1")?.status).toBe("ready_retake");

    const pass = await submitPreA1ChapterExam(repo, fill, allCorrectAnswers(fill));
    expect(pass.breakdown.passed).toBe(true);
    expect(pass.unlockedA1).toBe(true);
    expect(repo.getSavedGate("pre-A1")?.status).toBe("passed");
    expect(repo.getSavedGate("pre-A1")?.reviewAssignment).toBeNull();
    expect(repo.getUnit0()?.status).toBe("available");
  });

  it("open-mode fail does not assign a blocking review", async () => {
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "available" })],
      openAdultProfile(),
    );
    const fill = makeValidExamFill();
    const result = await submitPreA1ChapterExam(repo, fill, allWrongAnswers(fill));

    expect(result.reviewAssigned).toBe(false);
    expect(repo.getSavedGate("pre-A1")?.status).toBe("pending");
    expect(isPreA1ExamStartAllowed("pending")).toBe(true);
    expect(repo.getUnit0()?.status).toBe("available");
  });

  it("open-mode fail unlocks A1 when it was still locked", async () => {
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
      openAdultProfile(),
    );
    const fill = makeValidExamFill();
    const result = await submitPreA1ChapterExam(repo, fill, allWrongAnswers(fill));

    expect(result.reviewAssigned).toBe(false);
    expect(result.unlockedA1).toBe(true);
    expect(repo.getUnit0()?.status).toBe("available");
    expect(repo.getSavedGate("pre-A1")?.status).toBe("pending");
  });
});

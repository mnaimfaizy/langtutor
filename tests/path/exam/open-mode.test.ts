/**
 * Open-mode end-to-end for adults (issue #119 / ADR 0033 / 0042).
 *
 * Covers the real exam → score → gate → report path (not only the foundation stub):
 * open fail unlocks/leaves A1 open; strict fail blocks; kids ignore stored open.
 */
import { describe, expect, it } from "vitest";

import type { ChapterGate, ContentRepository, NewContent, NewUnit, Profile, Unit } from "@/lib/db";
import {
  effectiveProgressionMode,
  isA1BlockedByPreA1Gate,
  shouldShowPreA1ChapterGatePendingCta,
} from "@/lib/path/chapter-gate";
import {
  persistPreA1ExamTeacherReport,
  submitPreA1ChapterExam,
  type TeacherReport,
} from "@/lib/path/exam";

import { allWrongAnswers, makeValidExamFill } from "./fixtures";

type FakeRepo = ContentRepository & {
  getSavedGate: (tier: string) => ChapterGate | undefined;
  getUnit0: () => Unit | undefined;
  putContents: NewContent[];
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
    putContents: state.putContents,
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

const completedPreA1 = [-4, -3, -2, -1].map((index, i) =>
  unit({ id: i + 1, index, status: "completed" }),
);

function openAdult(): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: { progressionMode: "open", enablePreA1: true },
    experienceMode: "adult",
  };
}

function strictAdult(): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: { progressionMode: "strict", enablePreA1: true },
    experienceMode: "adult",
  };
}

/** Kid account that still has a leftover open setting from a prior adult session. */
function kidWithStoredOpen(): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: { progressionMode: "open", enablePreA1: true },
    experienceMode: "kid",
  };
}

const SAMPLE_REPORT: TeacherReport = {
  headline: "Keep practicing",
  body: "Alphabet and phonics need another look before A1 feels easy.",
  encouragement: "You are close — one more round will help.",
  focusSkills: ["alphabet", "phonics"],
};

describe("open mode end-to-end (issue #119)", () => {
  it("adult open fail unlocks A1, keeps the exam CTA, and still persists a teacher report", async () => {
    const profile = openAdult();
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
      profile,
    );
    const fill = makeValidExamFill();

    const result = await submitPreA1ChapterExam(repo, fill, allWrongAnswers(fill));

    expect(result.breakdown.passed).toBe(false);
    expect(result.reviewAssigned).toBe(false);
    expect(result.unlockedA1).toBe(true);
    expect(repo.getUnit0()?.status).toBe("available");
    expect(repo.getSavedGate("pre-A1")?.status).toBe("pending");
    expect(repo.getSavedGate("pre-A1")?.reviewAssignment ?? null).toBeNull();

    // Gate still pending → home CTA remains (feedback without block).
    expect(
      shouldShowPreA1ChapterGatePendingCta({
        units: [...completedPreA1, unit({ id: 10, index: 0, status: "available" })],
        gateStatus: "pending",
        stagesReadyForExam: true,
      }),
    ).toBe(true);
    expect(
      isA1BlockedByPreA1Gate({
        profile,
        units: [...completedPreA1, unit({ id: 10, index: 0, status: "available" })],
        gateStatus: "pending",
        stagesReadyForExam: true,
      }),
    ).toBe(false);

    const reportId = await persistPreA1ExamTeacherReport(repo, result.contentId, SAMPLE_REPORT);
    expect(reportId).toBeGreaterThan(0);
    expect(repo.putContents.some((c) => c.topic === "chapter-exam-report:pre-A1")).toBe(true);
  });

  it("adult open fail leaves an already-unlocked A1 available (no block, no review)", async () => {
    const profile = openAdult();
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "available" })],
      profile,
    );
    const fill = makeValidExamFill();

    const result = await submitPreA1ChapterExam(repo, fill, allWrongAnswers(fill));

    expect(result.breakdown.passed).toBe(false);
    expect(result.unlockedA1).toBe(false);
    expect(result.reviewAssigned).toBe(false);
    expect(repo.getUnit0()?.status).toBe("available");
    expect(repo.getSavedGate("pre-A1")?.status).toBe("pending");
    expect(
      isA1BlockedByPreA1Gate({
        profile,
        units: [...completedPreA1, unit({ id: 10, index: 0, status: "available" })],
        gateStatus: "pending",
        stagesReadyForExam: true,
      }),
    ).toBe(false);
  });

  it("adult strict fail blocks A1 and assigns review (unchanged)", async () => {
    const profile = strictAdult();
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
      profile,
    );
    const fill = makeValidExamFill();

    const result = await submitPreA1ChapterExam(repo, fill, allWrongAnswers(fill));

    expect(result.breakdown.passed).toBe(false);
    expect(result.unlockedA1).toBe(false);
    expect(result.reviewAssigned).toBe(true);
    expect(repo.getUnit0()?.status).toBe("locked");
    expect(repo.getSavedGate("pre-A1")?.status).toBe("failed_review");
    expect(
      isA1BlockedByPreA1Gate({
        profile,
        units: [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
        gateStatus: "failed_review",
        stagesReadyForExam: true,
      }),
    ).toBe(true);
  });

  it("kid ignores stored open — fail still blocks A1", async () => {
    const profile = kidWithStoredOpen();
    expect(effectiveProgressionMode(profile)).toBe("strict");

    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
      profile,
    );
    const fill = makeValidExamFill();
    const result = await submitPreA1ChapterExam(repo, fill, allWrongAnswers(fill));

    expect(result.reviewAssigned).toBe(true);
    expect(result.unlockedA1).toBe(false);
    expect(repo.getUnit0()?.status).toBe("locked");
    expect(repo.getSavedGate("pre-A1")?.status).toBe("failed_review");
    expect(
      isA1BlockedByPreA1Gate({
        profile,
        units: [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
        gateStatus: "failed_review",
        stagesReadyForExam: true,
      }),
    ).toBe(true);
  });
});

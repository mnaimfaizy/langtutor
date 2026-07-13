import { describe, expect, it } from "vitest";

import type {
  ChapterGate,
  ContentRepository,
  NewUnit,
  Profile,
  SharedPathStage,
  Unit,
} from "@/lib/db";
import { PRE_A1_STAGE_IDS } from "@/lib/db";
import { reconcilePreA1ChapterBoundary } from "@/lib/path/reconcile-pre-a1-gate";

type FakeRepo = ContentRepository & {
  getUnit0: () => Unit | undefined;
  setStagesReady: (ready: boolean) => void;
};

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

function makeFakeRepo(units: Unit[], profile: Profile, stagesReady: boolean): FakeRepo {
  const state = {
    units: units.slice(),
    chapterGates: new Map<string, ChapterGate>(),
    profile,
    stagesReady,
  };
  return {
    getUnit0() {
      return state.units.find((u) => u.index === 0);
    },
    setStagesReady(ready: boolean) {
      state.stagesReady = ready;
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
    async getProfile() {
      return state.profile;
    },
    async getSharedPathStages(): Promise<SharedPathStage[]> {
      return PRE_A1_STAGE_IDS.map((id, order) => ({
        id,
        tier: "pre-A1" as const,
        title: id,
        spineSectionKey: `spine.stages.${id}`,
        order,
        readyForExam: state.stagesReady,
        updatedAt: new Date(0),
      }));
    },
  } as unknown as FakeRepo;
}

const completedPreA1 = [-4, -3, -2, -1].map((index, i) =>
  unit({ id: i + 1, index, status: "completed" }),
);

describe("reconcilePreA1ChapterBoundary (issue #128)", () => {
  it("does not unlock A1 while stages are not ready", async () => {
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
      {
        goals: [],
        createdAt: new Date(0),
        settings: { progressionMode: "open", enablePreA1: true },
        experienceMode: "adult",
      },
      false,
    );

    await reconcilePreA1ChapterBoundary(repo);

    expect(repo.getUnit0()?.status).toBe("locked");
  });

  it("unlocks A1 in open mode once stages become ready", async () => {
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
      {
        goals: [],
        createdAt: new Date(0),
        settings: { progressionMode: "open", enablePreA1: true },
        experienceMode: "adult",
      },
      true,
    );

    await reconcilePreA1ChapterBoundary(repo);

    expect(repo.getUnit0()?.status).toBe("available");
  });

  it("keeps A1 locked in strict mode once stages are ready but gate pending", async () => {
    const repo = makeFakeRepo(
      [...completedPreA1, unit({ id: 10, index: 0, status: "locked" })],
      {
        goals: [],
        createdAt: new Date(0),
        settings: {},
        experienceMode: "kid",
      },
      true,
    );

    await reconcilePreA1ChapterBoundary(repo);

    expect(repo.getUnit0()?.status).toBe("locked");
  });
});

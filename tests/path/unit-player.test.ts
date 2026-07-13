import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChapterGate, ContentRepository, NewUnit, Profile, QuestState, Unit } from "@/lib/db";
import { onUnitCompleted } from "@/lib/path/unit-events";
import { completeUnitActivity } from "@/lib/path/unit-player";

/** No-op stand-in for the real path-buffer replenishment trigger (issue #61) — keeps these
 * state-machine tests from making real network calls. Dedicated tests below cover the trigger
 * itself. */
const noopReplenish = async () => {};

type FakeRepo = ContentRepository & {
  units: Unit[];
  setProfile: (profile: Profile | undefined) => void;
  getSavedGate: (tier: string) => ChapterGate | undefined;
  setStagesReady: (ready: boolean) => void;
};

/** Minimal in-memory stand-in — only the methods completeUnitActivity touches are real. */
function makeFakeRepo(initial: Unit[]): FakeRepo {
  const state = {
    units: initial.slice(),
    questState: undefined as QuestState | undefined,
    profile: undefined as Profile | undefined,
    chapterGates: new Map<string, ChapterGate>(),
    stagesReady: true,
  };
  return {
    units: state.units,
    setProfile(profile: Profile | undefined) {
      state.profile = profile;
    },
    setStagesReady(ready: boolean) {
      state.stagesReady = ready;
    },
    getSavedGate(tier: string) {
      return state.chapterGates.get(tier);
    },
    async getUnits() {
      return state.units;
    },
    async updateUnit(id: number, changes: Partial<NewUnit>) {
      const idx = state.units.findIndex((u) => u.id === id);
      if (idx === -1) return;
      state.units[idx] = { ...state.units[idx]!, ...changes };
    },
    async getQuestState() {
      return state.questState;
    },
    async saveQuestState(next: QuestState) {
      state.questState = next;
    },
    async getProfile() {
      return state.profile;
    },
    async getChapterGate(tier: string) {
      return state.chapterGates.get(tier);
    },
    async saveChapterGate(gate: ChapterGate) {
      state.chapterGates.set(gate.tier, gate);
    },
    async getSharedPathStages() {
      const ids = ["alphabet", "phonics", "picture-words", "listen-tap"] as const;
      return ids.map((id, order) => ({
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

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    index: 0,
    title: "Unit 1",
    teacherNote: "note",
    targetGrammarIds: ["simple_present"],
    targetVocab: [],
    targetCefr: "A1",
    activities: [{ skill: "review" }, { skill: "reading" }],
    status: "available",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

describe("completeUnitActivity", () => {
  let unsubscribe: (() => void) | null = null;

  beforeEach(() => {
    unsubscribe?.();
    unsubscribe = null;
  });

  it("marks the activity done and moves the unit to in-progress on a partial completion", async () => {
    const repo = makeFakeRepo([unit()]);

    await completeUnitActivity(repo, repo.units, 1, 0, noopReplenish);

    const [saved] = await repo.getUnits();
    expect(saved?.activities[0]).toEqual({ skill: "review", done: true });
    expect(saved?.status).toBe("in-progress");
  });

  it("records active-day quest progress on a partial activity completion", async () => {
    const repo = makeFakeRepo([unit()]);

    await completeUnitActivity(repo, repo.units, 1, 0, noopReplenish);

    const questState = await repo.getQuestState();
    expect(questState?.entries.find((e) => e.questId === "weekly-active-days")?.progress).toBe(1);
    expect(questState?.entries.find((e) => e.questId === "daily-finish-unit")?.progress).toBe(0);
  });

  it("completes the unit and unlocks the next locked unit on the final activity", async () => {
    const first = unit({
      id: 1,
      index: 0,
      activities: [{ skill: "review", done: true }, { skill: "reading" }],
      status: "in-progress",
    });
    const second = unit({ id: 2, index: 1, status: "locked" });
    const repo = makeFakeRepo([first, second]);

    await completeUnitActivity(repo, repo.units, 1, 1, noopReplenish);

    const units = await repo.getUnits();
    expect(units.find((u) => u.id === 1)?.status).toBe("completed");
    expect(units.find((u) => u.id === 2)?.status).toBe("available");
  });

  it("emits a completion event only when the unit becomes fully complete", async () => {
    const events: number[] = [];
    unsubscribe = onUnitCompleted((e) => events.push(e.unitId));

    const repo = makeFakeRepo([unit()]);

    await completeUnitActivity(repo, repo.units, 1, 0, noopReplenish);
    expect(events).toEqual([]); // partial completion — no event yet

    await completeUnitActivity(repo, repo.units, 1, 1, noopReplenish);
    expect(events).toEqual([1]);
  });

  it("records unit-finish quest progress when the final activity completes the unit", async () => {
    const repo = makeFakeRepo([unit()]);

    await completeUnitActivity(repo, repo.units, 1, 0, noopReplenish);
    await completeUnitActivity(repo, repo.units, 1, 1, noopReplenish);

    const questState = await repo.getQuestState();
    expect(questState?.entries.find((e) => e.questId === "daily-finish-unit")?.progress).toBe(1);
    expect(questState?.entries.find((e) => e.questId === "weekly-units-2")?.progress).toBe(1);
    expect(questState?.entries.find((e) => e.questId === "weekly-active-days")?.progress).toBe(1);
  });

  it("is a no-op when the activity is already done (idempotent)", async () => {
    const done = unit({ activities: [{ skill: "review", done: true }, { skill: "reading" }] });
    const repo = makeFakeRepo([done]);
    let writeCount = 0;
    const originalUpdate = repo.updateUnit.bind(repo);
    repo.updateUnit = async (id, changes) => {
      writeCount++;
      return originalUpdate(id, changes);
    };

    await completeUnitActivity(repo, repo.units, 1, 0, noopReplenish);

    expect(writeCount).toBe(0);
  });

  it("is a no-op for an unknown unit id", async () => {
    const repo = makeFakeRepo([unit()]);

    await expect(
      completeUnitActivity(repo, repo.units, 999, 0, noopReplenish),
    ).resolves.toBeUndefined();
    expect((await repo.getUnits())[0]?.status).toBe("available");
  });

  it.each(["review", "reading", "listening", "writing", "speaking"] as const)(
    "marks a %s activity done regardless of module type (issue #60 — full activity coverage)",
    async (skill) => {
      const repo = makeFakeRepo([unit({ activities: [{ skill }] })]);

      await completeUnitActivity(repo, repo.units, 1, 0, noopReplenish);

      const [saved] = await repo.getUnits();
      expect(saved?.activities[0]).toEqual({ skill, done: true });
      expect(saved?.status).toBe("completed");
    },
  );

  it("does not unlock the next unit when it's already unlocked", async () => {
    const first = unit({
      id: 1,
      index: 0,
      activities: [{ skill: "review", done: true }, { skill: "reading" }],
    });
    const second = unit({ id: 2, index: 1, status: "available" });
    const repo = makeFakeRepo([first, second]);

    await completeUnitActivity(repo, repo.units, 1, 1, noopReplenish);

    const units = await repo.getUnits();
    expect(units.find((u) => u.id === 2)?.status).toBe("available");
  });
});

describe("completeUnitActivity — pre-A1 chapter gate hold (issue #114)", () => {
  function preA1Path(): Unit[] {
    return [
      unit({
        id: 1,
        index: -4,
        status: "completed",
        activities: [{ skill: "alphabet", done: true }],
      }),
      unit({
        id: 2,
        index: -3,
        status: "completed",
        activities: [{ skill: "phonics", done: true }],
      }),
      unit({
        id: 3,
        index: -2,
        status: "completed",
        activities: [{ skill: "picture-match", done: true }],
      }),
      unit({
        id: 4,
        index: -1,
        status: "in-progress",
        activities: [{ skill: "listen-tap" }],
      }),
      unit({ id: 5, index: 0, status: "locked", activities: [{ skill: "review" }] }),
    ];
  }

  it("holds A1 unlock in strict mode and persists a pending pre-A1 gate", async () => {
    const repo = makeFakeRepo(preA1Path());
    repo.setProfile({
      goals: [],
      createdAt: new Date(0),
      settings: {},
      experienceMode: "kid",
    });

    await completeUnitActivity(repo, repo.units, 4, 0, noopReplenish);

    const units = await repo.getUnits();
    expect(units.find((u) => u.id === 4)?.status).toBe("completed");
    expect(units.find((u) => u.id === 5)?.status).toBe("locked");
    expect(repo.getSavedGate("pre-A1")?.status).toBe("pending");
  });

  it("unlocks A1 in open mode while still persisting a pending gate", async () => {
    const repo = makeFakeRepo(preA1Path());
    repo.setProfile({
      goals: [],
      createdAt: new Date(0),
      settings: { progressionMode: "open", enablePreA1: true },
      experienceMode: "adult",
    });

    await completeUnitActivity(repo, repo.units, 4, 0, noopReplenish);

    const units = await repo.getUnits();
    expect(units.find((u) => u.id === 5)?.status).toBe("available");
    expect(repo.getSavedGate("pre-A1")?.status).toBe("pending");
  });

  it("holds A1 in open mode when shared stages are not exam-ready (issue #128)", async () => {
    const repo = makeFakeRepo(preA1Path());
    repo.setStagesReady(false);
    repo.setProfile({
      goals: [],
      createdAt: new Date(0),
      settings: { progressionMode: "open", enablePreA1: true },
      experienceMode: "adult",
    });

    await completeUnitActivity(repo, repo.units, 4, 0, noopReplenish);

    const units = await repo.getUnits();
    expect(units.find((u) => u.id === 5)?.status).toBe("locked");
    // No gate row until the enrichment bar clears — growing state, not exam CTA.
    expect(repo.getSavedGate("pre-A1")).toBeUndefined();
  });

  it("unlocks A1 in strict mode once the gate is already passed", async () => {
    const repo = makeFakeRepo(preA1Path());
    repo.setProfile({
      goals: [],
      createdAt: new Date(0),
      settings: {},
      experienceMode: "kid",
    });
    await repo.saveChapterGate({
      tier: "pre-A1",
      status: "passed",
      updatedAt: new Date(0),
    });

    await completeUnitActivity(repo, repo.units, 4, 0, noopReplenish);

    const units = await repo.getUnits();
    expect(units.find((u) => u.id === 5)?.status).toBe("available");
    expect(repo.getSavedGate("pre-A1")?.status).toBe("passed");
  });
});

describe("completeUnitActivity — path-buffer replenishment trigger (issue #61)", () => {
  it("fires replenishment once a unit becomes fully complete", async () => {
    const repo = makeFakeRepo([unit()]);
    const replenish = vi.fn(async () => {});

    await completeUnitActivity(repo, repo.units, 1, 0, replenish);
    await completeUnitActivity(repo, repo.units, 1, 1, replenish);

    expect(replenish).toHaveBeenCalledTimes(1);
    expect(replenish).toHaveBeenCalledWith(repo);
  });

  it("does not fire replenishment on a partial completion", async () => {
    const repo = makeFakeRepo([unit()]);
    const replenish = vi.fn(async () => {});

    await completeUnitActivity(repo, repo.units, 1, 0, replenish);

    expect(replenish).not.toHaveBeenCalled();
  });

  it("does not await replenishment — completion resolves even if it never settles", async () => {
    const repo = makeFakeRepo([unit({ activities: [{ skill: "review" }] })]);
    let resolveReplenish: (() => void) | undefined;
    const replenish = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveReplenish = resolve;
        }),
    );

    await completeUnitActivity(repo, repo.units, 1, 0, replenish);

    expect(replenish).toHaveBeenCalledTimes(1);
    resolveReplenish?.();
  });

  it("does not fire replenishment on an idempotent re-completion", async () => {
    const done = unit({ activities: [{ skill: "review", done: true }] });
    const repo = makeFakeRepo([done]);
    const replenish = vi.fn(async () => {});

    await completeUnitActivity(repo, repo.units, 1, 0, replenish);

    expect(replenish).not.toHaveBeenCalled();
  });
});

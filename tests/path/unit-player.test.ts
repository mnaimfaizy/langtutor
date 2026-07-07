import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentRepository, NewUnit, Unit } from "@/lib/db";
import { onUnitCompleted } from "@/lib/path/unit-events";
import { completeUnitActivity } from "@/lib/path/unit-player";

/** No-op stand-in for the real path-buffer replenishment trigger (issue #61) — keeps these
 * state-machine tests from making real network calls. Dedicated tests below cover the trigger
 * itself. */
const noopReplenish = async () => {};

/** Minimal in-memory stand-in — only the two methods completeUnitActivity touches are real. */
function makeFakeRepo(initial: Unit[]): ContentRepository & { units: Unit[] } {
  const state = { units: initial.slice() };
  return {
    units: state.units,
    async getUnits() {
      return state.units;
    },
    async updateUnit(id: number, changes: Partial<NewUnit>) {
      const idx = state.units.findIndex((u) => u.id === id);
      if (idx === -1) return;
      state.units[idx] = { ...state.units[idx]!, ...changes };
    },
  } as unknown as ContentRepository & { units: Unit[] };
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

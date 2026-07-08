import { describe, expect, it } from "vitest";

import type { ContentRepository, NewUnit, Profile, Unit } from "@/lib/db";
import { PRE_A1_UNIT_COUNT } from "@/lib/path/pre-a1";
import { ensurePath, loadPathIfEmpty, syncPreA1Units } from "@/lib/path/seed";

/** Minimal in-memory stand-in — only the methods seeding touches are real. */
function makeFakeRepo(): ContentRepository & { units: Unit[] } {
  const state: { units: Unit[] } = { units: [] };
  let nextId = 1;

  return {
    units: state.units,
    async getProfile() {
      return undefined;
    },
    async getUnits() {
      return state.units;
    },
    async addUnit(unit: NewUnit) {
      const id = nextId++;
      state.units.push({ ...unit, id });
      return id;
    },
    async deleteUnit(id: number) {
      state.units = state.units.filter((u) => u.id !== id);
    },
    async updateUnit(id: number, changes: Partial<NewUnit>) {
      const idx = state.units.findIndex((u) => u.id === id);
      if (idx === -1) return;
      state.units[idx] = { ...state.units[idx]!, ...changes };
    },
  } as unknown as ContentRepository & { units: Unit[] };
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: {},
    cefrLevel: "A1",
    ...overrides,
  };
}

describe("loadPathIfEmpty", () => {
  it("seeds the backbone path when the learner has no units yet", async () => {
    const repo = makeFakeRepo();

    await loadPathIfEmpty(repo, "A1");

    const units = await repo.getUnits();
    expect(units.length).toBeGreaterThan(0);
    expect(units[0]?.status).toBe("available");
    expect(units[0]?.index).toBe(0);
  });

  it("is a no-op when the learner already has a path", async () => {
    const repo = makeFakeRepo();
    await repo.addUnit({
      index: 0,
      title: "Existing unit",
      teacherNote: "note",
      targetGrammarIds: ["simple_present"],
      targetVocab: [],
      targetCefr: "A1",
      activities: [],
      status: "available",
      bufferStatus: "empty",
      createdAt: new Date(0),
    });

    await loadPathIfEmpty(repo, "A1");

    const units = await repo.getUnits();
    expect(units).toHaveLength(1);
    expect(units[0]?.title).toBe("Existing unit");
  });

  it("de-duplicates concurrent callers via the seeding mutex", async () => {
    const repo = makeFakeRepo();

    await Promise.all([loadPathIfEmpty(repo, "A1"), loadPathIfEmpty(repo, "A1")]);

    const units = await repo.getUnits();
    const uniqueIndexes = new Set(units.map((u) => u.index));
    expect(uniqueIndexes.size).toBe(units.length);
  });
});

describe("syncPreA1Units", () => {
  it("seeds pre-A1 units for a kid-mode learner", async () => {
    const repo = makeFakeRepo();
    await loadPathIfEmpty(repo, "A1");

    await syncPreA1Units(repo, profile({ experienceMode: "kid" }));

    const units = await repo.getUnits();
    const preA1 = units.filter((u) => u.index < 0);
    expect(preA1).toHaveLength(PRE_A1_UNIT_COUNT);
    expect(preA1[0]?.status).toBe("available");
    expect(units.find((u) => u.index === 0)?.status).toBe("locked");
  });

  it("does not seed pre-A1 for adult mode without opt-in", async () => {
    const repo = makeFakeRepo();
    await loadPathIfEmpty(repo, "A1");

    await syncPreA1Units(repo, profile({ experienceMode: "adult" }));

    expect((await repo.getUnits()).every((u) => u.index >= 0)).toBe(true);
  });

  it("seeds pre-A1 for adult mode when opted in", async () => {
    const repo = makeFakeRepo();
    await loadPathIfEmpty(repo, "A1");

    await syncPreA1Units(
      repo,
      profile({ experienceMode: "adult", settings: { enablePreA1: true } }),
    );

    expect((await repo.getUnits()).filter((u) => u.index < 0)).toHaveLength(PRE_A1_UNIT_COUNT);
  });

  it("removes pre-A1 units when adult opt-in is turned off", async () => {
    const repo = makeFakeRepo();
    await loadPathIfEmpty(repo, "A1");
    await syncPreA1Units(
      repo,
      profile({ experienceMode: "adult", settings: { enablePreA1: true } }),
    );

    await syncPreA1Units(repo, profile({ experienceMode: "adult", settings: {} }));

    const units = await repo.getUnits();
    expect(units.every((u) => u.index >= 0)).toBe(true);
    expect(units.length).toBeGreaterThan(0);
  });

  it("does not seed pre-A1 once unit 0 is in progress", async () => {
    const repo = makeFakeRepo();
    await loadPathIfEmpty(repo, "A1");
    const a1 = (await repo.getUnits()).find((u) => u.index === 0)!;
    await repo.updateUnit(a1.id, { status: "in-progress" });

    await syncPreA1Units(repo, profile({ experienceMode: "kid" }));

    expect((await repo.getUnits()).every((u) => u.index >= 0)).toBe(true);
  });
});

describe("ensurePath", () => {
  it("seeds backbone and pre-A1 for a new kid-mode learner", async () => {
    const repo = makeFakeRepo();

    await ensurePath(repo, profile({ experienceMode: "kid" }));

    const units = await repo.getUnits();
    expect(units.filter((u) => u.index < 0)).toHaveLength(PRE_A1_UNIT_COUNT);
    expect(units.some((u) => u.index === 0)).toBe(true);
  });
});

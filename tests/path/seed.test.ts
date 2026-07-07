import { describe, expect, it } from "vitest";

import type { ContentRepository, NewUnit, Unit } from "@/lib/db";
import { loadPathIfEmpty } from "@/lib/path/seed";

/** Minimal in-memory stand-in — only the two methods loadPathIfEmpty touches are real. */
function makeFakeRepo(): ContentRepository & { units: Unit[] } {
  const state: { units: Unit[] } = { units: [] };
  let nextId = 1;

  return {
    units: state.units,
    async getUnits() {
      return state.units;
    },
    async addUnit(unit: NewUnit) {
      const id = nextId++;
      state.units.push({ ...unit, id });
      return id;
    },
  } as unknown as ContentRepository & { units: Unit[] };
}

describe("loadPathIfEmpty", () => {
  it("seeds the backbone path when the learner has no units yet", async () => {
    const repo = makeFakeRepo();

    await loadPathIfEmpty(repo, "A1");

    const units = await repo.getUnits();
    expect(units.length).toBeGreaterThan(0);
    expect(units[0]?.status).toBe("available");
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

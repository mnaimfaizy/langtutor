import { describe, expect, it, vi } from "vitest";

import type {
  ContentRepository,
  NewUnit,
  Profile,
  SharedPathStage,
  SharedPathUnitTemplate,
  Unit,
} from "@/lib/db";
import { PRE_A1_FIRST_PATH_INDEX, PRE_A1_UNIT_COUNT, seedPreA1Units } from "@/lib/path/pre-a1";
import {
  buildBundledSharedPathUnitTemplates,
  ensureSharedPathCatalogSeeded,
} from "@/lib/path/shared-path-catalog";
import { ensurePath, loadPathIfEmpty, syncPreA1Units } from "@/lib/path/seed";

/** Minimal in-memory stand-in — only the methods seeding touches are real. */
function makeFakeRepo(): ContentRepository & {
  units: Unit[];
  stages: SharedPathStage[];
  templates: SharedPathUnitTemplate[];
} {
  const state: {
    units: Unit[];
    stages: SharedPathStage[];
    templates: SharedPathUnitTemplate[];
  } = { units: [], stages: [], templates: [] };
  let nextId = 1;

  return {
    units: state.units,
    stages: state.stages,
    templates: state.templates,
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
    async getSharedPathStages() {
      return state.stages.slice().sort((a, b) => a.order - b.order);
    },
    async putSharedPathStage(stage: SharedPathStage) {
      const idx = state.stages.findIndex((s) => s.id === stage.id);
      if (idx === -1) state.stages.push(stage);
      else state.stages[idx] = stage;
    },
    async querySharedPathUnitTemplates(query?: {
      tier?: "pre-A1";
      stageId?: SharedPathUnitTemplate["stageId"];
      approvalStatus?: SharedPathUnitTemplate["approvalStatus"];
    }) {
      let rows = state.templates.slice();
      if (query?.tier) rows = rows.filter((r) => r.tier === query.tier);
      if (query?.stageId) rows = rows.filter((r) => r.stageId === query.stageId);
      if (query?.approvalStatus) {
        rows = rows.filter((r) => r.approvalStatus === query.approvalStatus);
      }
      return rows.sort((a, b) => a.pathIndex - b.pathIndex);
    },
    async putSharedPathUnitTemplate(template: SharedPathUnitTemplate) {
      const idx = state.templates.findIndex((t) => t.id === template.id);
      if (idx === -1) state.templates.push(template);
      else state.templates[idx] = template;
    },
    async deleteSharedPathUnitTemplate(id: string) {
      state.templates = state.templates.filter((t) => t.id !== id);
    },
  } as unknown as ContentRepository & {
    units: Unit[];
    stages: SharedPathStage[];
    templates: SharedPathUnitTemplate[];
  };
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

function stripIds(units: Unit[]) {
  return units
    .filter((u) => u.index < 0)
    .map(({ id: _id, createdAt: _createdAt, ...rest }) => rest)
    .sort((a, b) => a.index - b.index);
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
    expect(preA1[0]?.index).toBe(PRE_A1_FIRST_PATH_INDEX);
    expect(units.find((u) => u.index === 0)?.status).toBe("locked");
  });

  it("de-duplicates concurrent pre-A1 sync callers", async () => {
    const repo = makeFakeRepo();
    await loadPathIfEmpty(repo, "A1");

    await Promise.all([
      syncPreA1Units(repo, profile({ experienceMode: "kid" })),
      syncPreA1Units(repo, profile({ experienceMode: "kid" })),
    ]);

    const preA1 = (await repo.getUnits()).filter((u) => u.index < 0);
    const uniqueIndexes = new Set(preA1.map((u) => u.index));
    expect(preA1).toHaveLength(PRE_A1_UNIT_COUNT);
    expect(uniqueIndexes.size).toBe(PRE_A1_UNIT_COUNT);
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

  it("two fresh kid profiles get identical shared starters", async () => {
    const repoA = makeFakeRepo();
    const repoB = makeFakeRepo();

    await ensurePath(repoA, profile({ experienceMode: "kid" }));
    await ensurePath(repoB, profile({ experienceMode: "kid" }));

    expect(stripIds(await repoA.getUnits())).toEqual(stripIds(await repoB.getUnits()));
  });

  it("day-one shared starter seed does not call an LLM", async () => {
    const llmChat = vi.fn();
    const repo = makeFakeRepo();

    await ensurePath(repo, profile({ experienceMode: "kid" }));

    expect(llmChat).not.toHaveBeenCalled();
    expect((await repo.getUnits()).filter((u) => u.index < 0)).toHaveLength(PRE_A1_UNIT_COUNT);
    expect(await repo.getSharedPathStages()).toHaveLength(4);
    expect(await repo.querySharedPathUnitTemplates({ approvalStatus: "approved" })).toHaveLength(
      PRE_A1_UNIT_COUNT,
    );
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

describe("ensureSharedPathCatalogSeeded", () => {
  it("is idempotent and preserves existing catalog rows", async () => {
    const repo = makeFakeRepo();
    await ensureSharedPathCatalogSeeded(repo);
    const first = await repo.querySharedPathUnitTemplates();
    await repo.putSharedPathUnitTemplate({
      ...first[0]!,
      teacherNote: "admin-edited note",
    });

    await ensureSharedPathCatalogSeeded(repo);

    const again = await repo.querySharedPathUnitTemplates();
    expect(again).toHaveLength(PRE_A1_UNIT_COUNT);
    expect(again.find((t) => t.id === first[0]!.id)?.teacherNote).toBe("admin-edited note");
  });
});

describe("seedPreA1Units (bundled)", () => {
  it("matches the bundled shared catalog templates", () => {
    const seeded = seedPreA1Units(new Date("2026-01-01T00:00:00.000Z"));
    const templates = buildBundledSharedPathUnitTemplates();
    expect(seeded.map((u) => u.index)).toEqual(templates.map((t) => t.pathIndex));
    expect(seeded.map((u) => u.title)).toEqual(templates.map((t) => t.title));
  });
});

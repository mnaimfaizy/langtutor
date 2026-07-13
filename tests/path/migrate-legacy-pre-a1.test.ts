/**
 * Issue #130 / ADR 0056 — migrate legacy four-unit pre-A1 profiles onto the shared starter.
 */
import { describe, expect, it } from "vitest";

import type {
  ChapterGate,
  ContentRepository,
  NewUnit,
  Profile,
  SharedPathStage,
  SharedPathUnitTemplate,
  Unit,
} from "@/lib/db";
import { resolveStagesReadyForExam } from "@/lib/path/chapter-gate";
import {
  isLegacyFourUnitPreA1Path,
  legacyPreA1StageInventory,
  mapLegacyProgressToSharedStarter,
  migrateLegacyPreA1Units,
  remapLegacyReviewAssignment,
} from "@/lib/path/migrate-legacy-pre-a1";
import { ensurePath, syncPreA1Units } from "@/lib/path/seed";
import {
  PRE_A1_UNIT_COUNT,
  buildBundledSharedPathUnitTemplates,
} from "@/lib/path/shared-path-catalog";
import { groupPreA1UnitsByStage } from "@/lib/path/stages";

type FakeRepo = ContentRepository & {
  units: Unit[];
  stages: SharedPathStage[];
  templates: SharedPathUnitTemplate[];
  gates: Map<string, ChapterGate>;
};

function makeFakeRepo(seedUnits: Unit[] = []): FakeRepo {
  const state: {
    units: Unit[];
    stages: SharedPathStage[];
    templates: SharedPathUnitTemplate[];
    gates: Map<string, ChapterGate>;
  } = {
    units: seedUnits.slice(),
    stages: [],
    templates: [],
    gates: new Map(),
  };
  let nextId = Math.max(0, ...seedUnits.map((u) => u.id)) + 1;

  const repo = {
    get units() {
      return state.units;
    },
    get stages() {
      return state.stages;
    },
    get templates() {
      return state.templates;
    },
    get gates() {
      return state.gates;
    },
    async getProfile() {
      return undefined;
    },
    async getUnits() {
      return state.units.slice();
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
    async getChapterGate(tier: string) {
      return state.gates.get(tier);
    },
    async saveChapterGate(gate: ChapterGate) {
      state.gates.set(gate.tier, gate);
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
  };

  return repo as unknown as FakeRepo;
}

function legacyUnit(index: -4 | -3 | -2 | -1, status: Unit["status"], id: number): Unit {
  const titles = {
    [-4]: "Pre-A1: Alphabet",
    [-3]: "Pre-A1: Phonics",
    [-2]: "Pre-A1: Picture words",
    [-1]: "Pre-A1: Listen & tap",
  } as const;
  const skills = {
    [-4]: "alphabet",
    [-3]: "phonics",
    [-2]: "picture-match",
    [-1]: "listen-tap",
  } as const;
  return {
    id,
    index,
    title: titles[index],
    teacherNote: "legacy",
    targetGrammarIds: [],
    targetVocab: [],
    targetCefr: "A1",
    activities: [{ skill: skills[index] }],
    status,
    bufferStatus: "empty",
    createdAt: new Date(0),
  };
}

function a1Unit(status: Unit["status"], id: number): Unit {
  return {
    id,
    index: 0,
    title: "A1 unit 0",
    teacherNote: "backbone",
    targetGrammarIds: [],
    targetVocab: [],
    targetCefr: "A1",
    activities: [{ skill: "reading" }],
    status,
    bufferStatus: "empty",
    createdAt: new Date(0),
  };
}

function kidProfile(): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: {},
    cefrLevel: "A1",
    experienceMode: "kid",
  };
}

describe("legacy four-unit inventory (issue #130)", () => {
  it("documents the four skill-family stages the old path covered", () => {
    expect(legacyPreA1StageInventory()).toEqual([
      "alphabet",
      "phonics",
      "picture-words",
      "listen-tap",
    ]);
  });

  it("detects the old −4…−1 ladder and rejects the shared six-unit starter", () => {
    const legacy = [-4, -3, -2, -1].map((index, i) =>
      legacyUnit(index as -4 | -3 | -2 | -1, "locked", i + 1),
    );
    expect(isLegacyFourUnitPreA1Path(legacy)).toBe(true);

    const shared = mapLegacyProgressToSharedStarter(
      legacy,
      buildBundledSharedPathUnitTemplates(),
    ).map((u, i) => ({ ...u, id: i + 1 }));
    expect(shared).toHaveLength(PRE_A1_UNIT_COUNT);
    expect(isLegacyFourUnitPreA1Path(shared)).toBe(false);
  });
});

describe("mapLegacyProgressToSharedStarter", () => {
  it("maps an in-progress old path onto stage completion + resume point", () => {
    const legacy = [
      legacyUnit(-4, "completed", 1),
      legacyUnit(-3, "in-progress", 2),
      legacyUnit(-2, "locked", 3),
      legacyUnit(-1, "locked", 4),
    ];
    const mapped = mapLegacyProgressToSharedStarter(legacy, buildBundledSharedPathUnitTemplates());

    const byIndex = Object.fromEntries(mapped.map((u) => [u.index, u]));
    // Alphabet runway (−6…−4) fully completed from legacy Alphabet.
    expect(byIndex[-6]?.status).toBe("completed");
    expect(byIndex[-5]?.status).toBe("completed");
    expect(byIndex[-4]?.status).toBe("completed");
    expect(byIndex[-6]?.activities.every((a) => a.done)).toBe(true);
    // Phonics stage resumes at its first (only) unit.
    expect(byIndex[-3]?.status).toBe("in-progress");
    expect(byIndex[-2]?.status).toBe("locked");
    expect(byIndex[-1]?.status).toBe("locked");
  });

  it("marks the whole shared starter complete when every legacy unit is done", () => {
    const legacy = [-4, -3, -2, -1].map((index, i) =>
      legacyUnit(index as -4 | -3 | -2 | -1, "completed", i + 1),
    );
    const mapped = mapLegacyProgressToSharedStarter(legacy, buildBundledSharedPathUnitTemplates());
    expect(mapped.every((u) => u.status === "completed")).toBe(true);
  });
});

describe("migrateLegacyPreA1Units via syncPreA1Units / ensurePath", () => {
  it("migrates an in-progress old path and leaves a playable resume unit", async () => {
    const repo = makeFakeRepo([
      legacyUnit(-4, "completed", 1),
      legacyUnit(-3, "available", 2),
      legacyUnit(-2, "locked", 3),
      legacyUnit(-1, "locked", 4),
      a1Unit("locked", 10),
    ]);

    await syncPreA1Units(repo, kidProfile());

    const units = await repo.getUnits();
    const preA1 = units.filter((u) => u.index < 0);
    expect(preA1).toHaveLength(PRE_A1_UNIT_COUNT);
    expect(isLegacyFourUnitPreA1Path(preA1)).toBe(false);
    expect(groupPreA1UnitsByStage(preA1).map((g) => g.stageId)).toEqual([
      "alphabet",
      "phonics",
      "picture-words",
      "listen-tap",
    ]);
    expect(preA1.find((u) => u.index === -3)?.status).toBe("available");
    expect(units.find((u) => u.index === 0)?.status).toBe("locked");
  });

  it("preserves a passed gate and A1 unlock without replaying the runway", async () => {
    const repo = makeFakeRepo([
      legacyUnit(-4, "completed", 1),
      legacyUnit(-3, "completed", 2),
      legacyUnit(-2, "completed", 3),
      legacyUnit(-1, "completed", 4),
      a1Unit("available", 10),
    ]);
    repo.gates.set("pre-A1", {
      tier: "pre-A1",
      status: "passed",
      updatedAt: new Date(0),
      reviewAssignment: null,
    });

    await syncPreA1Units(repo, kidProfile());

    const units = await repo.getUnits();
    const preA1 = units.filter((u) => u.index < 0);
    expect(preA1).toHaveLength(PRE_A1_UNIT_COUNT);
    expect(preA1.every((u) => u.status === "completed")).toBe(true);
    expect(units.find((u) => u.index === 0)?.status).toBe("available");
    expect(repo.gates.get("pre-A1")?.status).toBe("passed");
    // Grandfather: existing gate keeps exam readiness even if shared stages are not marked.
    expect(resolveStagesReadyForExam([], repo.gates.get("pre-A1"))).toBe(true);
  });

  it("leaves a fresh kid on the new shared starter unchanged", async () => {
    const repo = makeFakeRepo();
    await ensurePath(repo, kidProfile());

    const preA1 = (await repo.getUnits()).filter((u) => u.index < 0);
    expect(preA1).toHaveLength(PRE_A1_UNIT_COUNT);
    expect(preA1[0]?.status).toBe("available");
    expect(preA1[0]?.index).toBe(-PRE_A1_UNIT_COUNT);
    expect(preA1[0]?.title).toContain("Meet the letters");
    expect(isLegacyFourUnitPreA1Path(preA1)).toBe(false);

    // Second ensurePath is a no-op migrate (already shared shape).
    const before = preA1.map((u) => u.id);
    await ensurePath(repo, kidProfile());
    expect((await repo.getUnits()).filter((u) => u.index < 0).map((u) => u.id)).toEqual(before);
  });

  it("remaps legacy review-assignment unit indices onto catalog review targets", async () => {
    const remapped = remapLegacyReviewAssignment({
      createdAt: new Date(0).toISOString(),
      items: [
        {
          id: "alphabet",
          unitIndex: -4,
          skill: "alphabet",
          label: "Alphabet",
          done: false,
        },
      ],
    });
    expect(remapped.items[0]?.unitIndex).toBe(-6);

    const repo = makeFakeRepo([
      legacyUnit(-4, "completed", 1),
      legacyUnit(-3, "completed", 2),
      legacyUnit(-2, "completed", 3),
      legacyUnit(-1, "completed", 4),
      a1Unit("locked", 10),
    ]);
    repo.gates.set("pre-A1", {
      tier: "pre-A1",
      status: "failed_review",
      updatedAt: new Date(0),
      reviewAssignment: {
        createdAt: new Date(0).toISOString(),
        items: [
          {
            id: "alphabet",
            unitIndex: -4,
            skill: "alphabet",
            label: "Alphabet",
            done: false,
          },
        ],
      },
    });

    expect(await migrateLegacyPreA1Units(repo)).toBe(true);
    expect(repo.gates.get("pre-A1")?.reviewAssignment?.items[0]?.unitIndex).toBe(-6);
  });
});

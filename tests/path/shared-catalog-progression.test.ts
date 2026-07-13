/**
 * Issue #126 — pre-A1 progression consumes the shared path catalog only.
 * Two learners completing the same unit must unlock the same next catalog units;
 * seed / completion / replenish must not invent a private AI path.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ContentRepository,
  NewUnit,
  Profile,
  SharedPathStage,
  SharedPathUnitTemplate,
  Unit,
} from "@/lib/db";
import type { LLMClient } from "@/lib/llm/llm-client";
import type { ChatMessage, ChatObjectOptions, ChatOptions } from "@/lib/llm/types";
import { decideReplenishment } from "@/lib/path/buffer";
import { PRE_A1_UNIT_COUNT } from "@/lib/path/pre-a1";
import { replenishPathBuffer } from "@/lib/path/replenish";
import { ensurePath } from "@/lib/path/seed";
import { planFutureUnits } from "@/lib/path/teacher-planner";
import { completeUnitActivity } from "@/lib/path/unit-player";

type FakeRepo = ContentRepository & {
  units: Unit[];
  addUnitCalls: NewUnit[];
};

function makeFakeRepo(): FakeRepo {
  const state: {
    units: Unit[];
    stages: SharedPathStage[];
    templates: SharedPathUnitTemplate[];
    addUnitCalls: NewUnit[];
  } = { units: [], stages: [], templates: [], addUnitCalls: [] };
  let nextId = 1;

  return {
    units: state.units,
    addUnitCalls: state.addUnitCalls,
    async getProfile() {
      return undefined;
    },
    async getUnits() {
      return state.units.slice();
    },
    async addUnit(unit: NewUnit) {
      state.addUnitCalls.push(unit);
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
    async getQuestState() {
      return undefined;
    },
    async saveQuestState() {},
    async getChapterGate() {
      return undefined;
    },
    async saveChapterGate() {},
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
  } as unknown as FakeRepo;
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

function stripIds(units: Unit[]) {
  return units
    .filter((u) => u.index < 0)
    .map(({ id: _id, createdAt: _createdAt, ...rest }) => rest)
    .sort((a, b) => a.index - b.index);
}

function makeSpyLLM(): { llm: LLMClient; chatCalls: () => number } {
  let chatCalls = 0;
  const llm: LLMClient = {
    chat: (async <T>(_msgs: ChatMessage[], opts?: ChatOptions | ChatObjectOptions<T>) => {
      chatCalls++;
      const plan = {
        title: "Private invented unit",
        teacherNote: "should never land on pre-A1",
        targetVocab: ["invented"],
      };
      if (opts && "schema" in opts) return opts.schema.parse(plan) as T;
      return "";
    }) as LLMClient["chat"],
    streamChat: async () =>
      (async function* () {
        yield "";
      })(),
    embed: async () => [],
    listModels: async () => [],
  };
  return { llm, chatCalls: () => chatCalls };
}

async function completeAllActivities(repo: FakeRepo, unitId: number): Promise<void> {
  const unit = (await repo.getUnits()).find((u) => u.id === unitId);
  if (!unit) throw new Error(`missing unit ${unitId}`);
  for (let i = 0; i < unit.activities.length; i++) {
    const snapshot = await repo.getUnits();
    await completeUnitActivity(repo, snapshot, unitId, i, async () => {});
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shared catalog progression (issue #126)", () => {
  it("two learners completing the same pre-A1 unit unlock identical next catalog units", async () => {
    const repoA = makeFakeRepo();
    const repoB = makeFakeRepo();
    await ensurePath(repoA, kidProfile());
    await ensurePath(repoB, kidProfile());

    expect(stripIds(await repoA.getUnits())).toEqual(stripIds(await repoB.getUnits()));

    const firstA = (await repoA.getUnits()).find((u) => u.status === "available")!;
    const firstB = (await repoB.getUnits()).find((u) => u.status === "available")!;
    expect(firstA.index).toBe(firstB.index);

    const addCountBeforeA = repoA.addUnitCalls.length;
    const addCountBeforeB = repoB.addUnitCalls.length;

    await completeAllActivities(repoA, firstA.id);
    await completeAllActivities(repoB, firstB.id);

    // Completion unlocks the next locked catalog unit — it must not invent/add a private one.
    expect(repoA.addUnitCalls.length).toBe(addCountBeforeA);
    expect(repoB.addUnitCalls.length).toBe(addCountBeforeB);

    expect(stripIds(await repoA.getUnits())).toEqual(stripIds(await repoB.getUnits()));

    const nextA = (await repoA.getUnits()).find((u) => u.status === "available");
    const nextB = (await repoB.getUnits()).find((u) => u.status === "available");
    expect(nextA?.index).toBe(firstA.index + 1);
    expect(nextB?.index).toBe(firstB.index + 1);
    expect(nextA?.title).toBe(nextB?.title);
    expect(nextA?.teacherNote).toBe(nextB?.teacherNote);
    expect(nextA?.activities.map((a) => a.skill)).toEqual(nextB?.activities.map((a) => a.skill));
  });

  it("unit completion replenish does not call /api/path/plan for a pre-A1-only window", async () => {
    const repo = makeFakeRepo();
    await ensurePath(repo, kidProfile());

    const fetchMock = vi.fn(async () =>
      Response.json({
        plans: [
          {
            unitId: 999,
            title: "Private invent",
            teacherNote: "nope",
            targetVocab: ["invented"],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const all = await repo.getUnits();
    const preA1 = all.filter((u) => u.index < 0);
    expect(preA1).toHaveLength(PRE_A1_UNIT_COUNT);
    // A1+ backbone units still exist and may need planning — exercise a pre-A1-only window.
    expect(decideReplenishment(preA1).toPlan).toEqual([]);

    await replenishPathBuffer(repo, PRE_A1_UNIT_COUNT, async () => 1);

    // With depth covering only future pre-A1 (available + locked), no plan API call.
    const futurePreA1 = (await repo.getUnits()).filter(
      (u) => u.index < 0 && (u.status === "available" || u.status === "locked"),
    );
    expect(decideReplenishment(futurePreA1, futurePreA1.length).toPlan).toEqual([]);

    // Re-run with a repo that has only pre-A1 future units in the window by depth=preA1 count
    // while A1+ are still locked further out — depth must not include them.
    fetchMock.mockClear();
    const depth = futurePreA1.length;
    await replenishPathBuffer(repo, depth, async () => 1);
    expect(fetchMock).not.toHaveBeenCalled();

    const after = (await repo.getUnits()).filter((u) => u.index < 0);
    expect(stripIds(after)).toEqual(stripIds(preA1));
  });

  it("teacher planner never rewrites pre-A1 catalog units via LLM", async () => {
    const { llm, chatCalls } = makeSpyLLM();
    const repo = makeFakeRepo();
    await ensurePath(repo, kidProfile());
    const units = await repo.getUnits();
    const preA1Ids = new Set(units.filter((u) => u.index < 0).map((u) => u.id));
    const catalogSnapshot = stripIds(units);

    const plans = await planFutureUnits(units, kidProfile(), [], llm);

    expect(plans.every((p) => !preA1Ids.has(p.unitId))).toBe(true);
    expect(stripIds(await repo.getUnits())).toEqual(catalogSnapshot);
    // A1+ planning may still call the LLM — that is intentional and intact.
    expect(chatCalls()).toBeGreaterThan(0);
  });
});

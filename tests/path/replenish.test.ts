import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentRepository, NewUnit, Unit, UnitActivityRef } from "@/lib/db";
import type { GenerateActivityContentFn } from "@/lib/path/replenish";
import { replenishPathBuffer } from "@/lib/path/replenish";

function activity(overrides: Partial<UnitActivityRef> = {}): UnitActivityRef {
  return { skill: "review", ...overrides };
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
    activities: [activity({ skill: "review" }), activity({ skill: "reading" })],
    status: "available",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

/** Minimal in-memory stand-in — only the two methods replenishPathBuffer touches are real. */
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

/** Stubs `fetch("/api/path/plan")` to return no plans — isolates content-generation tests
 * from the planning step. */
function stubEmptyPlanFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => Response.json({ plans: [] })) as unknown as ReturnType<
    typeof vi.fn
  >;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── planning step ──────────────────────────────────────────────────────────────

describe("replenishPathBuffer — planning", () => {
  it("persists a plan returned by /api/path/plan", async () => {
    const repo = makeFakeRepo([unit({ id: 1, targetVocab: [] })]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          plans: [
            { unitId: 1, title: "Talking About Now", teacherNote: "note", targetVocab: ["now"] },
          ],
        }),
      ),
    );

    await replenishPathBuffer(repo);

    const [saved] = await repo.getUnits();
    expect(saved?.title).toBe("Talking About Now");
    expect(saved?.targetVocab).toEqual(["now"]);
  });

  it("never throws when the plan endpoint is unreachable", async () => {
    const repo = makeFakeRepo([unit({ id: 1, targetVocab: [] })]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch failed");
      }),
    );

    await expect(replenishPathBuffer(repo)).resolves.toBeUndefined();
    expect((await repo.getUnits())[0]?.targetVocab).toEqual([]);
  });

  it("never throws on a non-ok plan response", async () => {
    const repo = makeFakeRepo([unit({ id: 1, targetVocab: [] })]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    await expect(replenishPathBuffer(repo)).resolves.toBeUndefined();
  });

  it("invokes onAfterPlan after planning is persisted and before content generation", async () => {
    const repo = makeFakeRepo([
      unit({
        id: 1,
        targetVocab: [],
        activities: [activity({ skill: "review" }), activity({ skill: "reading" })],
      }),
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          plans: [
            { unitId: 1, title: "Talking About Now", teacherNote: "note", targetVocab: ["now"] },
          ],
        }),
      ),
    );

    const order: string[] = [];
    const generate = vi.fn(async () => {
      order.push("generate");
      return 1;
    }) as unknown as GenerateActivityContentFn;

    await replenishPathBuffer(repo, 3, generate, async () => {
      order.push("after-plan");
      expect((await repo.getUnits())[0]?.title).toBe("Talking About Now");
    });

    expect(order[0]).toBe("after-plan");
    expect(order).toContain("generate");
    expect(order.indexOf("after-plan")).toBeLessThan(order.indexOf("generate"));
  });
});

// ── content-generation step ─────────────────────────────────────────────────────

describe("replenishPathBuffer — content generation", () => {
  let generate: GenerateActivityContentFn;
  let generateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    generateSpy = vi.fn(async () => 1);
    generate = generateSpy as unknown as GenerateActivityContentFn;
  });

  it("generates missing activity content and marks the unit buffered", async () => {
    stubEmptyPlanFetch();
    const repo = makeFakeRepo([
      unit({
        id: 1,
        targetVocab: ["now"],
        activities: [activity({ skill: "review" }), activity({ skill: "reading" })],
      }),
    ]);

    await replenishPathBuffer(repo, 3, generate);

    expect(generateSpy).toHaveBeenCalledTimes(1);
    const [saved] = await repo.getUnits();
    expect(saved?.activities[1]).toEqual({ skill: "reading", contentId: 1 });
    expect(saved?.bufferStatus).toBe("buffered");
  });

  it("does not call generate for a unit that's already fully buffered", async () => {
    stubEmptyPlanFetch();
    const repo = makeFakeRepo([
      unit({
        id: 1,
        targetVocab: ["now"],
        activities: [activity({ skill: "review" }), activity({ skill: "reading", contentId: 9 })],
      }),
    ]);

    await replenishPathBuffer(repo, 3, generate);

    expect(generateSpy).not.toHaveBeenCalled();
  });

  it("does not call generate for units still unplanned (targetVocab empty)", async () => {
    stubEmptyPlanFetch();
    const repo = makeFakeRepo([unit({ id: 1, targetVocab: [] })]);

    await replenishPathBuffer(repo, 3, generate);

    expect(generateSpy).not.toHaveBeenCalled();
  });

  it("skips already-completed and in-progress units", async () => {
    stubEmptyPlanFetch();
    const repo = makeFakeRepo([
      unit({
        id: 1,
        status: "completed",
        targetVocab: ["now"],
        activities: [activity({ skill: "reading" })],
      }),
      unit({
        id: 2,
        status: "in-progress",
        targetVocab: ["now"],
        activities: [activity({ skill: "reading" })],
      }),
    ]);

    await replenishPathBuffer(repo, 3, generate);

    expect(generateSpy).not.toHaveBeenCalled();
  });

  it("respects the buffer depth — stops generating beyond the window", async () => {
    stubEmptyPlanFetch();
    const repo = makeFakeRepo([
      unit({
        id: 1,
        index: 0,
        status: "available",
        targetVocab: ["now"],
        activities: [activity({ skill: "reading" })],
      }),
      unit({
        id: 2,
        index: 1,
        status: "locked",
        targetVocab: ["now"],
        activities: [activity({ skill: "reading" })],
      }),
    ]);

    await replenishPathBuffer(repo, 1, generate);

    expect(generateSpy).toHaveBeenCalledTimes(1);
    const units = await repo.getUnits();
    expect(units.find((u) => u.id === 2)?.bufferStatus).toBe("empty");
  });

  it("stops the whole pass at the first generation failure (unreachable provider)", async () => {
    stubEmptyPlanFetch();
    const failingGenerate = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed")) as unknown as GenerateActivityContentFn;
    const repo = makeFakeRepo([
      unit({
        id: 1,
        index: 0,
        status: "available",
        targetVocab: ["now"],
        activities: [activity({ skill: "reading" })],
      }),
      unit({
        id: 2,
        index: 1,
        status: "locked",
        targetVocab: ["now"],
        activities: [activity({ skill: "writing" })],
      }),
    ]);

    await replenishPathBuffer(repo, 3, failingGenerate);

    expect(failingGenerate).toHaveBeenCalledTimes(1);
    const units = await repo.getUnits();
    expect(units.find((u) => u.id === 1)?.bufferStatus).toBe("empty");
    expect(units.find((u) => u.id === 2)?.bufferStatus).toBe("empty");
  });

  it("keeps activities generated before a mid-unit failure", async () => {
    stubEmptyPlanFetch();
    const partialGenerate = vi
      .fn()
      .mockResolvedValueOnce(11)
      .mockRejectedValueOnce(new Error("fetch failed")) as unknown as GenerateActivityContentFn;
    const repo = makeFakeRepo([
      unit({
        id: 1,
        targetVocab: ["now"],
        activities: [activity({ skill: "reading" }), activity({ skill: "writing" })],
      }),
    ]);

    await replenishPathBuffer(repo, 3, partialGenerate);

    const [saved] = await repo.getUnits();
    expect(saved?.activities[0]).toEqual({ skill: "reading", contentId: 11 });
    expect(saved?.activities[1]).toEqual({ skill: "writing" });
    expect(saved?.bufferStatus).toBe("empty");
  });

  it("never throws even when generation and planning both fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch failed");
      }),
    );
    const failingGenerate = vi
      .fn()
      .mockRejectedValue(new Error("fetch failed")) as unknown as GenerateActivityContentFn;
    const repo = makeFakeRepo([
      unit({ id: 1, targetVocab: ["now"], activities: [activity({ skill: "reading" })] }),
    ]);

    await expect(replenishPathBuffer(repo, 3, failingGenerate)).resolves.toBeUndefined();
  });
});

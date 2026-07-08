import { describe, expect, it, vi } from "vitest";

import type { ContentRepository, NewUnit, Unit, UnitActivityRef } from "@/lib/db";
import type { GenerateActivityContentFn } from "@/lib/path/resume";
import { resolveUnitResumeTarget } from "@/lib/path/resume";

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

/** Minimal in-memory stand-in — only `updateUnit` is exercised by the resolver. */
function makeFakeRepo(initial: Unit[]): ContentRepository & { units: Unit[] } {
  const state = { units: initial.slice() };
  return {
    units: state.units,
    async updateUnit(id: number, changes: Partial<NewUnit>) {
      const idx = state.units.findIndex((u) => u.id === id);
      if (idx === -1) return;
      state.units[idx] = { ...state.units[idx]!, ...changes };
    },
  } as unknown as ContentRepository & { units: Unit[] };
}

describe("resolveUnitResumeTarget", () => {
  it("resolves a pending review activity directly, with no generation call", async () => {
    const repo = makeFakeRepo([unit()]);
    const generate = vi.fn() as unknown as GenerateActivityContentFn;

    const target = await resolveUnitResumeTarget(repo, unit(), generate);

    expect(target).toEqual({ href: "/review?unit=1&activity=0", activityIndex: 0 });
    expect(generate).not.toHaveBeenCalled();
  });

  it("resolves a pending alphabet activity directly, with no generation call", async () => {
    const u = unit({ activities: [activity({ skill: "alphabet" })] });
    const repo = makeFakeRepo([u]);
    const generate = vi.fn() as unknown as GenerateActivityContentFn;

    const target = await resolveUnitResumeTarget(repo, u, generate);

    expect(target).toEqual({ href: "/alphabet?unit=1&activity=0", activityIndex: 0 });
    expect(generate).not.toHaveBeenCalled();
  });

  it("resolves a pending phonics activity directly, with no generation call", async () => {
    const u = unit({ activities: [activity({ skill: "phonics" })] });
    const repo = makeFakeRepo([u]);
    const generate = vi.fn() as unknown as GenerateActivityContentFn;

    const target = await resolveUnitResumeTarget(repo, u, generate);

    expect(target).toEqual({ href: "/phonics?unit=1&activity=0", activityIndex: 0 });
    expect(generate).not.toHaveBeenCalled();
  });

  it("resolves a pending picture-match activity directly, with no generation call", async () => {
    const u = unit({ activities: [activity({ skill: "picture-match" })] });
    const repo = makeFakeRepo([u]);
    const generate = vi.fn() as unknown as GenerateActivityContentFn;

    const target = await resolveUnitResumeTarget(repo, u, generate);

    expect(target).toEqual({ href: "/picture-match?unit=1&activity=0", activityIndex: 0 });
    expect(generate).not.toHaveBeenCalled();
  });

  it("resolves a pending listen-tap activity directly, with no generation call", async () => {
    const u = unit({ activities: [activity({ skill: "listen-tap" })] });
    const repo = makeFakeRepo([u]);
    const generate = vi.fn() as unknown as GenerateActivityContentFn;

    const target = await resolveUnitResumeTarget(repo, u, generate);

    expect(target).toEqual({ href: "/listen-tap?unit=1&activity=0", activityIndex: 0 });
    expect(generate).not.toHaveBeenCalled();
  });

  it("resolves an already-buffered activity straight to its cached content, with no generation call", async () => {
    const u = unit({
      activities: [
        activity({ skill: "review", done: true }),
        activity({ skill: "reading", contentId: 42 }),
      ],
    });
    const repo = makeFakeRepo([u]);
    const generate = vi.fn() as unknown as GenerateActivityContentFn;

    const target = await resolveUnitResumeTarget(repo, u, generate);

    expect(target).toEqual({ href: "/reading/42?unit=1&activity=1", activityIndex: 1 });
    expect(generate).not.toHaveBeenCalled();
  });

  it("generates and caches content for a not-yet-buffered activity, then resolves to it", async () => {
    const u = unit({
      activities: [activity({ skill: "review", done: true }), activity({ skill: "reading" })],
    });
    const repo = makeFakeRepo([u]);
    const generate = vi.fn(async () => 7) as unknown as GenerateActivityContentFn;

    const target = await resolveUnitResumeTarget(repo, u, generate);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(target).toEqual({ href: "/reading/7?unit=1&activity=1", activityIndex: 1 });
    expect(repo.units[0]?.activities[1]).toEqual({ skill: "reading", contentId: 7 });
  });

  it("propagates a generation failure (unreachable provider) instead of swallowing it", async () => {
    const u = unit({ activities: [activity({ skill: "reading" })] });
    const repo = makeFakeRepo([u]);
    const generate = vi
      .fn()
      .mockRejectedValue(new Error("fetch failed")) as unknown as GenerateActivityContentFn;

    await expect(resolveUnitResumeTarget(repo, u, generate)).rejects.toThrow("fetch failed");
  });

  it("returns null for the degenerate case of a unit with no activities", async () => {
    const u = unit({ activities: [] });
    const repo = makeFakeRepo([u]);

    const target = await resolveUnitResumeTarget(repo, u);

    expect(target).toBeNull();
  });
});

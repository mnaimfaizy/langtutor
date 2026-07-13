import { describe, expect, it } from "vitest";

import type { Profile, Unit } from "@/lib/db";
import {
  PRE_A1_FIRST_PATH_INDEX,
  PRE_A1_UNIT_COUNT,
  hasReachedFirstA1Unit,
  seedPreA1Units,
  shouldSeedPreA1,
  shouldShowKidIsland,
} from "@/lib/path/pre-a1";
import { buildBundledSharedPathUnitTemplates } from "@/lib/path/shared-path-catalog";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: {},
    ...overrides,
  };
}

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    index: -1,
    title: "Pre-A1",
    teacherNote: "",
    targetGrammarIds: [],
    targetVocab: [],
    targetCefr: "A1",
    activities: [],
    status: "available",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

describe("seedPreA1Units", () => {
  it("produces negative indices ending at -1 for the four-stage starter", () => {
    const units = seedPreA1Units(new Date("2026-01-01T00:00:00.000Z"));
    const expected = buildBundledSharedPathUnitTemplates().map((t) => t.pathIndex);

    expect(units).toHaveLength(PRE_A1_UNIT_COUNT);
    expect(units.map((u) => u.index)).toEqual(expected);
    expect(units[0]?.index).toBe(PRE_A1_FIRST_PATH_INDEX);
    expect(units.at(-1)?.index).toBe(-1);
  });

  it("unlocks only the first pre-A1 unit", () => {
    const units = seedPreA1Units();

    expect(units[0]?.status).toBe("available");
    expect(units.slice(1).every((u) => u.status === "locked")).toBe(true);
  });

  it("keeps a rich Alphabet runway and light later-stage placeholders", () => {
    const units = seedPreA1Units();
    const templates = buildBundledSharedPathUnitTemplates();

    expect(units.every((u) => u.targetGrammarIds.length === 0)).toBe(true);
    expect(
      templates.filter((t) => t.stageId === "alphabet").every((t) => t.richness === "rich"),
    ).toBe(true);
    expect(
      templates.filter((t) => t.stageId !== "alphabet").every((t) => t.richness === "placeholder"),
    ).toBe(true);
    expect(units[0]?.activities.length).toBeGreaterThan(1);
    expect(units.at(-1)?.activities).toEqual([{ skill: "listen-tap" }]);
  });
});

describe("shouldSeedPreA1", () => {
  it("opts kid-mode learners in at the A1 floor", () => {
    expect(shouldSeedPreA1(profile({ experienceMode: "kid" }), "A1")).toBe(true);
  });

  it("skips kid mode when anchored above A1", () => {
    expect(shouldSeedPreA1(profile({ experienceMode: "kid" }), "A2")).toBe(false);
  });

  it("requires adult opt-in at the A1 floor", () => {
    expect(shouldSeedPreA1(profile({ experienceMode: "adult" }), "A1")).toBe(false);
    expect(
      shouldSeedPreA1(profile({ experienceMode: "adult", settings: { enablePreA1: true } }), "A1"),
    ).toBe(true);
  });
});

describe("hasReachedFirstA1Unit", () => {
  it("is false when unit 0 is still locked", () => {
    expect(
      hasReachedFirstA1Unit([
        {
          id: 1,
          index: -1,
          title: "Pre-A1",
          teacherNote: "",
          targetGrammarIds: [],
          targetVocab: [],
          targetCefr: "A1",
          activities: [],
          status: "available",
          bufferStatus: "empty",
          createdAt: new Date(0),
        },
        {
          id: 2,
          index: 0,
          title: "A1",
          teacherNote: "",
          targetGrammarIds: ["simple_present"],
          targetVocab: [],
          targetCefr: "A1",
          activities: [],
          status: "locked",
          bufferStatus: "empty",
          createdAt: new Date(0),
        },
      ]),
    ).toBe(false);
  });

  it("is false for a backbone-only path with unit 0 available", () => {
    expect(
      hasReachedFirstA1Unit([
        {
          id: 2,
          index: 0,
          title: "A1",
          teacherNote: "",
          targetGrammarIds: ["simple_present"],
          targetVocab: [],
          targetCefr: "A1",
          activities: [],
          status: "available",
          bufferStatus: "empty",
          createdAt: new Date(0),
        },
      ]),
    ).toBe(false);
  });

  it("is true once unit 0 is in progress", () => {
    expect(
      hasReachedFirstA1Unit([
        {
          id: 2,
          index: 0,
          title: "A1",
          teacherNote: "",
          targetGrammarIds: ["simple_present"],
          targetVocab: [],
          targetCefr: "A1",
          activities: [],
          status: "in-progress",
          bufferStatus: "empty",
          createdAt: new Date(0),
        },
      ]),
    ).toBe(true);
  });

  it("is true once every pre-A1 unit is completed", () => {
    expect(
      hasReachedFirstA1Unit([
        {
          id: 1,
          index: -1,
          title: "Pre-A1",
          teacherNote: "",
          targetGrammarIds: [],
          targetVocab: [],
          targetCefr: "A1",
          activities: [],
          status: "completed",
          bufferStatus: "empty",
          createdAt: new Date(0),
        },
        {
          id: 2,
          index: 0,
          title: "A1",
          teacherNote: "",
          targetGrammarIds: ["simple_present"],
          targetVocab: [],
          targetCefr: "A1",
          activities: [],
          status: "available",
          bufferStatus: "empty",
          createdAt: new Date(0),
        },
      ]),
    ).toBe(true);
  });
});

describe("shouldShowKidIsland", () => {
  it("shows the island for a kid learner still in the pre-A1 tier", () => {
    expect(
      shouldShowKidIsland(profile({ experienceMode: "kid" }), [
        unit({ index: -1, status: "available" }),
      ]),
    ).toBe(true);
  });

  it("shows the island for a fresh kid profile before the path is seeded", () => {
    expect(shouldShowKidIsland(profile({ experienceMode: "kid" }), [])).toBe(true);
  });

  it("hands off to the standard home once the kid learner reaches unit 0", () => {
    expect(
      shouldShowKidIsland(profile({ experienceMode: "kid" }), [
        unit({ index: -1, status: "completed" }),
        unit({ id: 2, index: 0, status: "in-progress" }),
      ]),
    ).toBe(false);
  });

  it("never shows the island in adult mode, even with pre-A1 units opted in", () => {
    expect(
      shouldShowKidIsland(profile({ experienceMode: "adult", settings: { enablePreA1: true } }), [
        unit({ index: -1, status: "available" }),
      ]),
    ).toBe(false);
  });
});

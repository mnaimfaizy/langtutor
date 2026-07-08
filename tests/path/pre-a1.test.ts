import { describe, expect, it } from "vitest";

import type { Profile } from "@/lib/db";
import {
  PRE_A1_UNIT_COUNT,
  hasReachedFirstA1Unit,
  seedPreA1Units,
  shouldSeedPreA1,
} from "@/lib/path/pre-a1";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: {},
    ...overrides,
  };
}

describe("seedPreA1Units", () => {
  it("produces negative indices ending at -1", () => {
    const units = seedPreA1Units(new Date("2026-01-01T00:00:00.000Z"));

    expect(units).toHaveLength(PRE_A1_UNIT_COUNT);
    expect(units.map((u) => u.index)).toEqual([-4, -3, -2, -1]);
  });

  it("unlocks only the first pre-A1 unit", () => {
    const units = seedPreA1Units();

    expect(units[0]?.status).toBe("available");
    expect(units.slice(1).every((u) => u.status === "locked")).toBe(true);
  });

  it("uses backbone placeholder activities with no grammar anchors", () => {
    const units = seedPreA1Units();

    expect(units.every((u) => u.targetGrammarIds.length === 0)).toBe(true);
    expect(units[0]?.activities).toEqual([{ skill: "alphabet" }]);
    expect(units[1]?.activities).toEqual([{ skill: "phonics" }]);
    expect(units[2]?.activities).toHaveLength(5);
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

import { describe, expect, it } from "vitest";

import type { GrammarConstruction } from "@/lib/content/grammar-map";
import { seedBackbonePath } from "@/lib/path/backbone-planner";

function construction(overrides: Partial<GrammarConstruction> = {}): GrammarConstruction {
  return {
    id: "simple_present",
    label: "Simple present tense",
    cefr: "A1",
    description: "Base verb form for habitual actions, facts, and permanent states.",
    markers: [],
    examples: [],
    ...overrides,
  };
}

const FIXTURE_MAP = [
  construction({ id: "a1_first", label: "A1 First", cefr: "A1" }),
  construction({ id: "a1_second", label: "A1 Second", cefr: "A1" }),
  construction({ id: "a2_first", label: "A2 First", cefr: "A2" }),
  construction({ id: "b1_first", label: "B1 First", cefr: "B1" }),
] as const;

describe("seedBackbonePath", () => {
  it("is deterministic — same inputs produce the same output", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const first = seedBackbonePath("A1", FIXTURE_MAP, now);
    const second = seedBackbonePath("A1", FIXTURE_MAP, now);

    expect(first).toEqual(second);
  });

  it("anchors the path at the requested CEFR level, skipping earlier levels", () => {
    const units = seedBackbonePath("A2", FIXTURE_MAP);

    expect(units.map((u) => u.targetGrammarIds[0])).toEqual(["a2_first", "b1_first"]);
  });

  it("includes every construction from the anchor level through the top of the map", () => {
    const units = seedBackbonePath("A1", FIXTURE_MAP);

    expect(units).toHaveLength(FIXTURE_MAP.length);
    expect(units.map((u) => u.targetCefr)).toEqual(["A1", "A1", "A2", "B1"]);
  });

  it("returns an empty path when the anchor level isn't present in the map", () => {
    const units = seedBackbonePath("C2", FIXTURE_MAP);

    expect(units).toEqual([]);
  });

  it("orders units ascending starting at index 0, reserving negative indices for pre-A1", () => {
    const units = seedBackbonePath("A1", FIXTURE_MAP);

    expect(units.map((u) => u.index)).toEqual([0, 1, 2, 3]);
    expect(units.every((u) => u.index >= 0)).toBe(true);
  });

  it("unlocks only the first unit — every later unit starts locked", () => {
    const units = seedBackbonePath("A1", FIXTURE_MAP);

    expect(units[0]?.status).toBe("available");
    expect(units.slice(1).every((u) => u.status === "locked")).toBe(true);
  });

  it("produces deterministic placeholder titles/notes with no LLM involvement", () => {
    const units = seedBackbonePath("A1", FIXTURE_MAP);

    expect(units[0]?.title).toBe("Unit 1: A1 First");
    expect(units[0]?.teacherNote).toBe(FIXTURE_MAP[0].description);
    expect(units[1]?.title).toBe("Unit 2: A1 Second");
  });

  it("starts every unit with an empty buffer (no content pre-generated)", () => {
    const units = seedBackbonePath("A1", FIXTURE_MAP);

    expect(units.every((u) => u.bufferStatus === "empty")).toBe(true);
  });

  it("reserves an ordered activity slot per skill, in a fixed skill order", () => {
    const units = seedBackbonePath("A1", FIXTURE_MAP);

    expect(units[0]?.activities).toEqual([
      { skill: "reading" },
      { skill: "writing" },
      { skill: "listening" },
      { skill: "speaking" },
    ]);
  });

  it("defaults to the real 39-entry grammar map when none is supplied", () => {
    const units = seedBackbonePath("A1");

    expect(units.length).toBeGreaterThan(0);
    expect(units[0]?.status).toBe("available");
  });
});

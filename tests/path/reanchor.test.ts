import { describe, expect, it, vi } from "vitest";

import type { GrammarConstruction } from "@/lib/content/grammar-map";
import type { ContentRepository, NewUnit, Profile, Unit } from "@/lib/db";
import { backboneActivities } from "@/lib/path/backbone-planner";
import { applyReanchor, reanchorFutureUnits, reanchorOnProfileChange } from "@/lib/path/reanchor";

// ── fixtures ────────────────────────────────────────────────────────────────

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

// 2 constructions per level so a re-anchor within a level (index 0 vs 1) is observable too.
const FIXTURE_MAP = [
  construction({ id: "a1_first", label: "A1 First", cefr: "A1" }),
  construction({ id: "a1_second", label: "A1 Second", cefr: "A1" }),
  construction({ id: "a2_first", label: "A2 First", cefr: "A2" }),
  construction({ id: "a2_second", label: "A2 Second", cefr: "A2" }),
  construction({ id: "b1_first", label: "B1 First", cefr: "B1" }),
  construction({ id: "b1_second", label: "B1 Second", cefr: "B1" }),
] as const;

function unit(overrides: Partial<Unit> & { id: number; index: number }): Unit {
  const construction = FIXTURE_MAP[overrides.index] ?? FIXTURE_MAP[0];
  return {
    title: `Unit ${overrides.index + 1}: ${construction.label}`,
    teacherNote: construction.description,
    targetGrammarIds: [construction.id],
    targetVocab: [],
    targetCefr: construction.cefr,
    activities: backboneActivities(),
    status: overrides.index === 0 ? "available" : "locked",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

/** A path seeded from A1 through the fixture map's end, as `seedBackbonePath("A1", ...)` would. */
function seededPath(): Unit[] {
  return FIXTURE_MAP.map((_, index) =>
    unit({ id: index, index, status: index === 0 ? "available" : "locked" }),
  );
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return { cefrLevel: "A1", goals: [], createdAt: new Date(0), settings: {}, ...overrides };
}

// ── reanchorFutureUnits — pure logic ──────────────────────────────────────────

describe("reanchorFutureUnits", () => {
  it("no-op: re-anchoring to the same level changes nothing", () => {
    const units = seededPath();
    const patches = reanchorFutureUnits(units, "A1", FIXTURE_MAP);

    expect(patches).toEqual([]);
  });

  it("no-op: a unit already anchored to what the new level would put at its index is skipped", () => {
    // Only the first unit is "future"; it already matches A1's first construction.
    const units = [unit({ id: 0, index: 0, status: "available" })];
    const patches = reanchorFutureUnits(units, "A1", FIXTURE_MAP);

    expect(patches).toEqual([]);
  });

  it("level up: advances future units past mastered material", () => {
    const units = seededPath();
    const patches = reanchorFutureUnits(units, "B1", FIXTURE_MAP);

    // Every unit is future (none completed/in-progress) — all 6 slots re-anchor to the B1+
    // suffix of the map, indices 0..5 -> map[4..9], but the fixture map only has 6 entries
    // (indices 4,5 exist; 6..9 are past the end and are left untouched).
    const changedIds = patches.map((p) => p.unitId);
    expect(changedIds).toEqual([0, 1]);
    expect(patches[0]?.changes.targetGrammarIds).toEqual(["b1_first"]);
    expect(patches[0]?.changes.targetCefr).toBe("B1");
    expect(patches[1]?.changes.targetGrammarIds).toEqual(["b1_second"]);
  });

  it("level down: reinforcing (earlier) units appear", () => {
    // Path seeded from B1 (indices 0,1 map to b1_first/b1_second); level drops to A1.
    const units = [
      unit({ id: 0, index: 0, status: "available", ...atConstruction(FIXTURE_MAP[4]) }),
      unit({ id: 1, index: 1, status: "locked", ...atConstruction(FIXTURE_MAP[5]) }),
    ];
    const patches = reanchorFutureUnits(units, "A1", FIXTURE_MAP);

    expect(patches).toHaveLength(2);
    expect(patches[0]?.changes.targetGrammarIds).toEqual(["a1_first"]);
    expect(patches[0]?.changes.targetCefr).toBe("A1");
    expect(patches[1]?.changes.targetGrammarIds).toEqual(["a1_second"]);
  });

  it("clears the plan and buffer of a re-anchored unit, marking it unplanned/unbuffered again", () => {
    const units = [
      unit({
        id: 0,
        index: 0,
        status: "available",
        targetVocab: ["already", "planned"],
        bufferStatus: "buffered",
        activities: [{ skill: "review" }, { skill: "listening", contentId: 42, done: false }],
      }),
    ];
    const patches = reanchorFutureUnits(units, "B1", FIXTURE_MAP);

    expect(patches[0]?.changes.targetVocab).toEqual([]);
    expect(patches[0]?.changes.bufferStatus).toBe("empty");
    expect(patches[0]?.changes.activities).toEqual(backboneActivities());
  });

  it("never re-anchors completed or in-progress units — the invariant holds even when their construction no longer matches the new level", () => {
    const units = [
      unit({ id: 0, index: 0, status: "completed" }),
      unit({ id: 1, index: 1, status: "in-progress" }),
      unit({ id: 2, index: 2, status: "locked" }),
    ];
    // A2 shifts index 2's construction from a2_first (its seeded default) to b1_first.
    const patches = reanchorFutureUnits(units, "A2", FIXTURE_MAP);

    expect(patches.map((p) => p.unitId)).toEqual([2]);
    expect(patches[0]?.changes.targetGrammarIds).toEqual(["b1_first"]);
  });

  it("preserves index/id — the path never grows, shrinks, or reorders", () => {
    const units = seededPath();
    const patches = reanchorFutureUnits(units, "B1", FIXTURE_MAP);

    for (const patch of patches) {
      expect(patch.changes).not.toHaveProperty("index");
      expect(patch.changes).not.toHaveProperty("id");
      expect(patch.changes).not.toHaveProperty("status");
    }
  });

  it("leaves a future unit untouched when the new level runs past the end of the curriculum", () => {
    // Index 5 + B1's start index (4) = 9, past the 6-entry fixture map.
    const units = [unit({ id: 5, index: 5, status: "locked" })];
    const patches = reanchorFutureUnits(units, "B1", FIXTURE_MAP);

    expect(patches).toEqual([]);
  });
});

function atConstruction(c: GrammarConstruction): Partial<NewUnit> {
  return {
    targetGrammarIds: [c.id],
    targetCefr: c.cefr,
    title: `x: ${c.label}`,
    teacherNote: c.description,
  };
}

// ── applyReanchor — persistence ───────────────────────────────────────────────

describe("applyReanchor", () => {
  function fakeRepo(units: Unit[]): ContentRepository {
    return {
      getUnits: vi.fn().mockResolvedValue(units),
      updateUnit: vi.fn().mockResolvedValue(undefined),
    } as unknown as ContentRepository;
  }

  it("persists exactly the patches reanchorFutureUnits decides on", async () => {
    const units = seededPath();
    const repo = fakeRepo(units);

    await applyReanchor(repo, "B1", FIXTURE_MAP);

    expect(repo.updateUnit).toHaveBeenCalledTimes(2);
    expect(repo.updateUnit).toHaveBeenNthCalledWith(
      1,
      0,
      expect.objectContaining({ targetGrammarIds: ["b1_first"] }),
    );
    expect(repo.updateUnit).toHaveBeenNthCalledWith(
      2,
      1,
      expect.objectContaining({ targetGrammarIds: ["b1_second"] }),
    );
  });

  it("writes nothing when re-anchoring is a no-op", async () => {
    const units = seededPath();
    const repo = fakeRepo(units);

    await applyReanchor(repo, "A1", FIXTURE_MAP);

    expect(repo.updateUnit).not.toHaveBeenCalled();
  });
});

// ── reanchorOnProfileChange — detection ───────────────────────────────────────

describe("reanchorOnProfileChange", () => {
  function fakeRepo(units: Unit[]): ContentRepository {
    return {
      getUnits: vi.fn().mockResolvedValue(units),
      updateUnit: vi.fn().mockResolvedValue(undefined),
    } as unknown as ContentRepository;
  }

  it("re-anchors when the CEFR level actually changed", async () => {
    const repo = fakeRepo(seededPath());

    await reanchorOnProfileChange(repo, profile({ cefrLevel: "A1" }), profile({ cefrLevel: "B1" }));

    expect(repo.updateUnit).toHaveBeenCalled();
  });

  it("does nothing when the level is unchanged", async () => {
    const repo = fakeRepo(seededPath());

    await reanchorOnProfileChange(repo, profile({ cefrLevel: "A1" }), profile({ cefrLevel: "A1" }));

    expect(repo.getUnits).not.toHaveBeenCalled();
    expect(repo.updateUnit).not.toHaveBeenCalled();
  });

  it("does nothing on a first-ever save (onboarding, not a change)", async () => {
    const repo = fakeRepo(seededPath());

    await reanchorOnProfileChange(repo, undefined, profile({ cefrLevel: "A1" }));

    expect(repo.getUnits).not.toHaveBeenCalled();
    expect(repo.updateUnit).not.toHaveBeenCalled();
  });

  it("does nothing when the new profile has no CEFR level yet", async () => {
    const repo = fakeRepo(seededPath());

    await reanchorOnProfileChange(
      repo,
      profile({ cefrLevel: "A1" }),
      profile({ cefrLevel: undefined }),
    );

    expect(repo.getUnits).not.toHaveBeenCalled();
    expect(repo.updateUnit).not.toHaveBeenCalled();
  });
});

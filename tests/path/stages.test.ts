import { describe, expect, it } from "vitest";

import type { Unit } from "@/lib/db";
import { seedPreA1Units } from "@/lib/path/pre-a1";
import {
  buildBundledSharedPathUnitTemplates,
  withContiguousPreA1PathIndices,
} from "@/lib/path/shared-path-catalog";
import {
  PLACEHOLDER_STAGE_BLURB,
  groupPreA1UnitsByStage,
  richnessForPathIndex,
  shortUnitTitle,
  splitUnitsByPreA1Stages,
} from "@/lib/path/stages";

function asUnits(seed = seedPreA1Units(new Date(0))): Unit[] {
  return seed.map((u, i) => ({ ...u, id: i + 1 }));
}

describe("groupPreA1UnitsByStage", () => {
  it("groups the shared starter into four stages with a multi-unit Alphabet runway", () => {
    const stages = groupPreA1UnitsByStage(asUnits());

    expect(stages).toHaveLength(4);
    expect(stages.map((s) => s.stageId)).toEqual([
      "alphabet",
      "phonics",
      "picture-words",
      "listen-tap",
    ]);
    expect(stages[0]?.units).toHaveLength(3);
    expect(stages.slice(1).every((s) => s.units.length === 1)).toBe(true);
    expect(stages[0]?.richness).toBe("rich");
    expect(stages.slice(1).every((s) => s.richness === "placeholder")).toBe(true);
    expect(stages[0]?.islandLabel).toBe("Letter Shore");
    expect(stages[1]?.title).toBe("Phonics");
  });

  it("places densified units using the live catalog pathIndex map (not bundled −6…−1)", () => {
    const templates = withContiguousPreA1PathIndices([
      ...buildBundledSharedPathUnitTemplates(),
      {
        id: "pre-a1.phonics.ai-draft",
        tier: "pre-A1" as const,
        stageId: "phonics" as const,
        stageOrder: 1,
        pathIndex: -30,
        title: "Pre-A1: Phonics — Short sounds",
        teacherNote: "Densified",
        activities: [{ skill: "phonics" as const }],
        richness: "rich" as const,
        approvalStatus: "approved" as const,
        provenance: "ai-draft" as const,
        targetVocab: ["cat", "sun"],
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ]);
    const units: Unit[] = templates.map((t, i) => ({
      id: i + 1,
      index: t.pathIndex,
      title: t.title,
      teacherNote: t.teacherNote,
      targetGrammarIds: [],
      targetVocab: t.targetVocab.slice(),
      targetCefr: "A1",
      activities: t.activities.map((a) => ({ skill: a.skill })),
      status: i === 0 ? "available" : "locked",
      bufferStatus: "empty",
      createdAt: new Date(0),
    }));

    // Live catalog is required for correct stage membership + richness after remaps.
    const stages = groupPreA1UnitsByStage(units, templates);
    expect(stages).toHaveLength(4);
    expect(stages.find((s) => s.stageId === "alphabet")?.units).toHaveLength(3);
    expect(stages.find((s) => s.stageId === "phonics")?.units).toHaveLength(2);
    expect(stages.find((s) => s.stageId === "phonics")?.units.map((u) => u.title)).toEqual([
      "Pre-A1: Phonics",
      "Pre-A1: Phonics — Short sounds",
    ]);
    expect(stages.find((s) => s.stageId === "phonics")?.richness).toBe("rich");
  });

  it("marks a stage complete only when every unit in it is completed", () => {
    const units = asUnits();
    units[0]!.status = "completed";
    units[1]!.status = "completed";
    expect(groupPreA1UnitsByStage(units)[0]?.isComplete).toBe(false);

    units[2]!.status = "completed";
    expect(groupPreA1UnitsByStage(units)[0]?.isComplete).toBe(true);
  });

  it("ignores A1+ units", () => {
    const units: Unit[] = [
      ...asUnits(),
      {
        id: 100,
        index: 0,
        title: "A1 start",
        teacherNote: "",
        targetGrammarIds: [],
        targetVocab: [],
        targetCefr: "A1",
        activities: [],
        status: "locked",
        bufferStatus: "empty",
        createdAt: new Date(0),
      },
    ];
    expect(groupPreA1UnitsByStage(units)).toHaveLength(4);
    expect(splitUnitsByPreA1Stages(units).afterPreA1).toHaveLength(1);
  });
});

describe("shortUnitTitle", () => {
  it("drops the Pre-A1 stage prefix so nodes read as story stops", () => {
    expect(shortUnitTitle("Pre-A1: Alphabet — Meet the letters")).toBe("Meet the letters");
    expect(shortUnitTitle("Pre-A1: Phonics")).toBe("Phonics");
  });
});

describe("richnessForPathIndex", () => {
  it("labels Alphabet runway rich and later stages as placeholders", () => {
    const units = asUnits();
    expect(richnessForPathIndex(units[0]!.index)).toBe("rich");
    expect(richnessForPathIndex(units.at(-1)!.index)).toBe("placeholder");
    expect(PLACEHOLDER_STAGE_BLURB.length).toBeGreaterThan(10);
  });
});

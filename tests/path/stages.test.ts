import { describe, expect, it } from "vitest";

import type { Unit } from "@/lib/db";
import { seedPreA1Units } from "@/lib/path/pre-a1";
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

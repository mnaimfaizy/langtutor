import { describe, expect, it } from "vitest";

import type { GrammarConstruction } from "@/lib/content/grammar-map";
import type { Weakness } from "@/lib/db";
import { buildTeacherPlanMessages, UnitPlanSchema } from "@/lib/path/teacher-plan";

function construction(overrides: Partial<GrammarConstruction> = {}): GrammarConstruction {
  return {
    id: "past_simple",
    label: "Past simple tense",
    cefr: "A2",
    description: "Regular and irregular past forms for completed actions.",
    markers: [],
    examples: ["She walked to school yesterday."],
    ...overrides,
  };
}

function weakness(overrides: Partial<Weakness> = {}): Weakness {
  return {
    skill: "writing",
    category: "article usage",
    cefr: "A2",
    score: 0.6,
    confidence: 0.5,
    updatedAt: new Date(0),
    ...overrides,
  };
}

// ── schema ──────────────────────────────────────────────────────────────────

describe("UnitPlanSchema", () => {
  it("accepts a well-formed plan", () => {
    const result = UnitPlanSchema.safeParse({
      title: "Talking About Yesterday",
      teacherNote: "This unit helps you talk about things that already happened.",
      targetVocab: ["yesterday", "walked", "finished", "already"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a plan missing a required field", () => {
    const result = UnitPlanSchema.safeParse({
      title: "Talking About Yesterday",
      targetVocab: ["yesterday", "walked", "finished"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 3 vocab words", () => {
    const result = UnitPlanSchema.safeParse({
      title: "Talking About Yesterday",
      teacherNote: "Note.",
      targetVocab: ["yesterday", "walked"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty title", () => {
    const result = UnitPlanSchema.safeParse({
      title: "",
      teacherNote: "Note.",
      targetVocab: ["yesterday", "walked", "finished"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-string vocab entry", () => {
    const result = UnitPlanSchema.safeParse({
      title: "Talking About Yesterday",
      teacherNote: "Note.",
      targetVocab: ["yesterday", 42, "finished"],
    });
    expect(result.success).toBe(false);
  });

  it("has exactly three fields — small and boring by design", () => {
    expect(Object.keys(UnitPlanSchema.shape)).toEqual(["title", "teacherNote", "targetVocab"]);
  });
});

// ── persona selection ─────────────────────────────────────────────────────────

describe("buildTeacherPlanMessages — persona by experience mode", () => {
  const baseCtx = {
    cefrLevel: "A2" as const,
    goals: [],
    construction: construction(),
    weaknesses: [] as Weakness[],
  };

  it("uses a professional-teacher persona in adult mode", () => {
    const [system] = buildTeacherPlanMessages({ ...baseCtx, experienceMode: "adult", goals: [] });
    expect(system.role).toBe("system");
    expect(system.content).toMatch(/professional/i);
    expect(system.content).not.toMatch(/kindergarten/i);
  });

  it("uses a kindergarten-teacher persona in kid mode", () => {
    const [system] = buildTeacherPlanMessages({ ...baseCtx, experienceMode: "kid", goals: [] });
    expect(system.role).toBe("system");
    expect(system.content).toMatch(/kindergarten/i);
    expect(system.content).not.toMatch(/professional/i);
  });

  it("keeps the same message shape/roles across both modes — persona is prompt-level only", () => {
    const adult = buildTeacherPlanMessages({ ...baseCtx, experienceMode: "adult", goals: [] });
    const kid = buildTeacherPlanMessages({ ...baseCtx, experienceMode: "kid", goals: [] });
    expect(adult.map((m) => m.role)).toEqual(kid.map((m) => m.role));
    expect(adult).toHaveLength(2);
  });

  it("asks for simpler vocab guidance in kid mode than adult mode", () => {
    const [, adultUser] = buildTeacherPlanMessages({ ...baseCtx, experienceMode: "adult" });
    const [, kidUser] = buildTeacherPlanMessages({ ...baseCtx, experienceMode: "kid" });
    expect(kidUser.content).toMatch(/simple/i);
    expect(adultUser.content).not.toBe(kidUser.content);
  });
});

// ── backbone anchoring ────────────────────────────────────────────────────────

describe("buildTeacherPlanMessages — backbone anchoring", () => {
  it("states the fixed grammar construction and tells the model not to change it", () => {
    const [, user] = buildTeacherPlanMessages({
      experienceMode: "adult",
      cefrLevel: "A2",
      goals: [],
      construction: construction({ label: "Past simple tense" }),
      weaknesses: [],
    });
    expect(user.content).toContain("Past simple tense");
    expect(user.content).toMatch(/do not invent a different one/i);
  });
});

// ── weakness-awareness ────────────────────────────────────────────────────────

describe("buildTeacherPlanMessages — weakness data", () => {
  it("mentions a weakness that meets the score/confidence bar", () => {
    const [, user] = buildTeacherPlanMessages({
      experienceMode: "adult",
      cefrLevel: "A2",
      goals: [],
      construction: construction(),
      weaknesses: [weakness({ category: "article usage", score: 0.7, confidence: 0.6 })],
    });
    expect(user.content).toContain("article usage");
  });

  it("falls back to a no-data note when there are no weaknesses", () => {
    const [, user] = buildTeacherPlanMessages({
      experienceMode: "adult",
      cefrLevel: "A2",
      goals: [],
      construction: construction(),
      weaknesses: [],
    });
    expect(user.content).toMatch(/no weakness data yet/i);
  });

  it("ignores low-confidence/low-score weaknesses as noise", () => {
    const [, user] = buildTeacherPlanMessages({
      experienceMode: "adult",
      cefrLevel: "A2",
      goals: [],
      construction: construction(),
      weaknesses: [weakness({ category: "rare typo", score: 0.1, confidence: 0.05 })],
    });
    expect(user.content).not.toContain("rare typo");
    expect(user.content).toMatch(/no weakness data yet/i);
  });

  it("only mentions the top few weaknesses when many are present", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      weakness({ category: `category-${i}`, score: 0.9 - i * 0.05, confidence: 0.8 }),
    );
    const [, user] = buildTeacherPlanMessages({
      experienceMode: "adult",
      cefrLevel: "A2",
      goals: [],
      construction: construction(),
      weaknesses: many,
    });
    expect(user.content).toContain("category-0");
    expect(user.content).not.toContain("category-5");
  });
});

// ── goals ─────────────────────────────────────────────────────────────────────

describe("buildTeacherPlanMessages — goals", () => {
  it("mentions the learner's stated goal", () => {
    const [, user] = buildTeacherPlanMessages({
      experienceMode: "adult",
      cefrLevel: "B1",
      goals: ["travel"],
      construction: construction(),
      weaknesses: [],
    });
    expect(user.content).toMatch(/travel/i);
  });

  it("falls back to general English when no goals are set", () => {
    const [, user] = buildTeacherPlanMessages({
      experienceMode: "adult",
      cefrLevel: "B1",
      goals: [],
      construction: construction(),
      weaknesses: [],
    });
    expect(user.content).toMatch(/general English/i);
  });
});

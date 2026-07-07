import { describe, expect, it, vi } from "vitest";

import type { NewUnit, Profile, Unit, Weakness } from "@/lib/db";
import type { LLMClient } from "@/lib/llm/llm-client";
import type { ChatMessage, ChatObjectOptions, ChatOptions } from "@/lib/llm/types";
import { UnitPlanSchema } from "@/lib/path/teacher-plan";
import { planFutureUnits, UNITS_TO_PLAN_PER_PASS } from "@/lib/path/teacher-planner";

// ── fixtures ────────────────────────────────────────────────────────────────

function unit(overrides: Partial<NewUnit> & { id: number }): Unit {
  return {
    index: overrides.id,
    title: `Unit ${overrides.id + 1}: placeholder`,
    teacherNote: "placeholder note",
    targetGrammarIds: ["simple_present"],
    targetVocab: [],
    targetCefr: "A1",
    activities: [],
    status: overrides.id === 0 ? "available" : "locked",
    bufferStatus: "empty",
    createdAt: new Date(0),
    ...overrides,
  };
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    cefrLevel: "A1",
    goals: [],
    createdAt: new Date(0),
    settings: {},
    ...overrides,
  };
}

const VALID_PLAN = {
  title: "Talking About Now",
  teacherNote: "This unit helps you describe things happening right now.",
  targetVocab: ["now", "currently", "today", "watching"],
};

function makeSequentialLLM(responses: unknown[]): LLMClient {
  let idx = 0;
  return {
    chat: (async <T>(
      _messages: ChatMessage[],
      opts?: ChatOptions | ChatObjectOptions<T>,
    ): Promise<string | T> => {
      const resp = responses[Math.min(idx++, responses.length - 1)];
      if (opts && "schema" in opts) return opts.schema.parse(resp) as T;
      return String(resp);
    }) as LLMClient["chat"],
    streamChat: async () =>
      (async function* (): AsyncGenerator<string> {
        yield "";
      })(),
    embed: async (texts) => texts.map(() => [0]),
    listModels: async () => [],
  };
}

/** Always throws — simulates an unreachable Mac. */
function makeUnreachableLLM(): LLMClient {
  return {
    chat: (async () => {
      throw new Error("fetch failed");
    }) as LLMClient["chat"],
    streamChat: async () =>
      (async function* () {
        yield "";
      })(),
    embed: async () => [],
    listModels: async () => [],
  };
}

// ── selection: which units get planned ────────────────────────────────────────

describe("planFutureUnits — unit selection", () => {
  it("plans an unplanned available unit", async () => {
    const units = [unit({ id: 0, status: "available", targetVocab: [] })];
    const plans = await planFutureUnits(units, profile(), [], makeSequentialLLM([VALID_PLAN]));

    expect(plans).toHaveLength(1);
    expect(plans[0]).toEqual({ unitId: 0, ...VALID_PLAN });
  });

  it("skips units that are already planned (non-empty targetVocab)", async () => {
    const units = [unit({ id: 0, status: "available", targetVocab: ["already", "planned"] })];
    const plans = await planFutureUnits(units, profile(), [], makeSequentialLLM([VALID_PLAN]));

    expect(plans).toHaveLength(0);
  });

  it("skips in-progress and completed units", async () => {
    const units = [
      unit({ id: 0, status: "in-progress", targetVocab: [] }),
      unit({ id: 1, status: "completed", targetVocab: [] }),
    ];
    const plans = await planFutureUnits(units, profile(), [], makeSequentialLLM([VALID_PLAN]));

    expect(plans).toHaveLength(0);
  });

  it("plans locked units too — locked is still 'future'", async () => {
    const units = [unit({ id: 0, status: "locked", targetVocab: [] })];
    const plans = await planFutureUnits(units, profile(), [], makeSequentialLLM([VALID_PLAN]));

    expect(plans).toHaveLength(1);
  });

  it("caps the number of units planned in a single pass", async () => {
    const units = Array.from({ length: UNITS_TO_PLAN_PER_PASS + 5 }, (_, i) =>
      unit({ id: i, status: i === 0 ? "available" : "locked", targetVocab: [] }),
    );
    const plans = await planFutureUnits(units, profile(), [], makeSequentialLLM([VALID_PLAN]));

    expect(plans).toHaveLength(UNITS_TO_PLAN_PER_PASS);
  });

  it("plans in ascending index order", async () => {
    const units = [
      unit({ id: 2, index: 2, status: "locked", targetVocab: [] }),
      unit({ id: 0, index: 0, status: "available", targetVocab: [] }),
      unit({ id: 1, index: 1, status: "locked", targetVocab: [] }),
    ];
    const plans = await planFutureUnits(units, profile(), [], makeSequentialLLM([VALID_PLAN]));

    expect(plans.map((p) => p.unitId)).toEqual([0, 1, 2]);
  });

  it("returns nothing when the profile has no CEFR level yet", async () => {
    const units = [unit({ id: 0, status: "available", targetVocab: [] })];
    const plans = await planFutureUnits(
      units,
      profile({ cefrLevel: undefined }),
      [],
      makeSequentialLLM([VALID_PLAN]),
    );

    expect(plans).toHaveLength(0);
  });

  it("never reorders or changes the backbone anchor — the plan shape has no index/grammar fields", async () => {
    const units = [unit({ id: 0, status: "available", targetVocab: [] })];
    const plans = await planFutureUnits(units, profile(), [], makeSequentialLLM([VALID_PLAN]));

    expect(Object.keys(plans[0])).toEqual(["unitId", "title", "teacherNote", "targetVocab"]);
  });
});

// ── corrective retry / failure surfacing ──────────────────────────────────────

describe("planFutureUnits — corrective retry and failure handling", () => {
  it("retries on malformed output, then succeeds", async () => {
    const chatSpy = vi
      .fn()
      .mockResolvedValueOnce({ title: "missing other fields" }) // fails UnitPlanSchema
      .mockResolvedValueOnce(VALID_PLAN);
    const llm: LLMClient = {
      chat: (async <T>(msgs: ChatMessage[], opts?: ChatOptions | ChatObjectOptions<T>) => {
        const resp: unknown = await chatSpy();
        if (opts && "schema" in opts) return opts.schema.parse(resp) as T;
        return String(resp);
      }) as LLMClient["chat"],
      streamChat: async () =>
        (async function* () {
          yield "";
        })(),
      embed: async () => [],
      listModels: async () => [],
    };

    const units = [unit({ id: 0, status: "available", targetVocab: [] })];
    const plans = await planFutureUnits(units, profile(), [], llm);

    expect(chatSpy).toHaveBeenCalledTimes(2);
    expect(plans).toEqual([{ unitId: 0, ...VALID_PLAN }]);
  });

  it("never crashes and never persists an unvalidated plan when the provider is unreachable", async () => {
    const units = [unit({ id: 0, status: "available", targetVocab: [] })];

    const plans = await planFutureUnits(units, profile(), [], makeUnreachableLLM());

    expect(plans).toEqual([]);
  });

  it("skips a unit that keeps failing validation but still plans the next one", async () => {
    let call = 0;
    const llm: LLMClient = {
      chat: (async <T>(_msgs: ChatMessage[], opts?: ChatOptions | ChatObjectOptions<T>) => {
        call++;
        // Unit 0 always returns an invalid plan; unit 1's calls return a valid one.
        const resp: unknown = call <= 4 ? { title: "bad" } : VALID_PLAN;
        if (opts && "schema" in opts) return opts.schema.parse(resp) as T;
        return String(resp);
      }) as LLMClient["chat"],
      streamChat: async () =>
        (async function* () {
          yield "";
        })(),
      embed: async () => [],
      listModels: async () => [],
    };

    const units = [
      unit({ id: 0, index: 0, status: "available", targetVocab: [] }),
      unit({ id: 1, index: 1, status: "locked", targetVocab: [] }),
    ];
    const plans = await planFutureUnits(units, profile(), [], llm);

    expect(plans).toEqual([{ unitId: 1, ...VALID_PLAN }]);
  });

  it("never returns output that fails Zod validation", async () => {
    const units = [unit({ id: 0, status: "available", targetVocab: [] })];
    const plans = await planFutureUnits(units, profile(), [], makeSequentialLLM([VALID_PLAN]));

    for (const plan of plans) {
      expect(() =>
        UnitPlanSchema.parse({
          title: plan.title,
          teacherNote: plan.teacherNote,
          targetVocab: plan.targetVocab,
        }),
      ).not.toThrow();
    }
  });
});

// ── weakness-awareness end-to-end ─────────────────────────────────────────────

describe("planFutureUnits — weakness data reaches the prompt", () => {
  it("includes a strong weakness's category in the messages sent to the LLM", async () => {
    const capturedMessages: ChatMessage[][] = [];
    const llm: LLMClient = {
      chat: (async <T>(msgs: ChatMessage[], opts?: ChatOptions | ChatObjectOptions<T>) => {
        capturedMessages.push(msgs);
        if (opts && "schema" in opts) return opts.schema.parse(VALID_PLAN) as T;
        return "";
      }) as LLMClient["chat"],
      streamChat: async () =>
        (async function* () {
          yield "";
        })(),
      embed: async () => [],
      listModels: async () => [],
    };

    const weaknesses: Weakness[] = [
      {
        skill: "writing",
        category: "article usage",
        cefr: "A1",
        score: 0.8,
        confidence: 0.7,
        updatedAt: new Date(0),
      },
    ];
    const units = [unit({ id: 0, status: "available", targetVocab: [] })];
    await planFutureUnits(units, profile(), weaknesses, llm);

    const userMessage = capturedMessages[0].find((m) => m.role === "user");
    expect(userMessage?.content).toContain("article usage");
  });
});

// ── persona selection via profile experience mode ─────────────────────────────

describe("planFutureUnits — persona selection by experience mode", () => {
  it("uses the kindergarten persona for kid-mode profiles", async () => {
    const capturedMessages: ChatMessage[][] = [];
    const llm: LLMClient = {
      chat: (async <T>(msgs: ChatMessage[], opts?: ChatOptions | ChatObjectOptions<T>) => {
        capturedMessages.push(msgs);
        if (opts && "schema" in opts) return opts.schema.parse(VALID_PLAN) as T;
        return "";
      }) as LLMClient["chat"],
      streamChat: async () =>
        (async function* () {
          yield "";
        })(),
      embed: async () => [],
      listModels: async () => [],
    };

    const units = [unit({ id: 0, status: "available", targetVocab: [] })];
    await planFutureUnits(units, profile({ experienceMode: "kid" }), [], llm);

    const systemMessage = capturedMessages[0].find((m) => m.role === "system");
    expect(systemMessage?.content).toMatch(/kindergarten/i);
  });

  it("uses the professional-teacher persona for adult-mode profiles", async () => {
    const capturedMessages: ChatMessage[][] = [];
    const llm: LLMClient = {
      chat: (async <T>(msgs: ChatMessage[], opts?: ChatOptions | ChatObjectOptions<T>) => {
        capturedMessages.push(msgs);
        if (opts && "schema" in opts) return opts.schema.parse(VALID_PLAN) as T;
        return "";
      }) as LLMClient["chat"],
      streamChat: async () =>
        (async function* () {
          yield "";
        })(),
      embed: async () => [],
      listModels: async () => [],
    };

    const units = [unit({ id: 0, status: "available", targetVocab: [] })];
    await planFutureUnits(units, profile({ experienceMode: "adult" }), [], llm);

    const systemMessage = capturedMessages[0].find((m) => m.role === "system");
    expect(systemMessage?.content).toMatch(/professional/i);
  });
});

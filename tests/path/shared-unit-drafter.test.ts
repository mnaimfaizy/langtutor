/**
 * Issue #131 — AI drafts later-stage pre-A1 units into shared pending (Zod + retry).
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Profile, SharedPathUnitTemplate, Unit } from "@/lib/db";
import * as schema from "@/lib/db/drizzle/schema";
import { SqliteContentRepository } from "@/lib/db/sqlite-content-repository";
import type { LLMClient } from "@/lib/llm/llm-client";
import type { ChatMessage, ChatObjectOptions, ChatOptions } from "@/lib/llm/types";
import { ensurePath } from "@/lib/path/seed";
import {
  fillThinSharedPathStages,
  stageNeedsSharedDensification,
} from "@/lib/path/shared-path-background-fill";
import {
  ensureSharedPathCatalogSeeded,
  materializePreA1UnitsFromCatalog,
} from "@/lib/path/shared-path-catalog";
import {
  buildSharedUnitDraftMessages,
  SharedUnitDraftSchema,
  STAGE_DRAFT_GUIDE_KEYS,
} from "@/lib/path/shared-unit-draft";
import {
  allocateUniquePathIndex,
  draftSharedPathUnit,
  nextStageOrder,
  SharedUnitDraftError,
} from "@/lib/path/shared-unit-drafter";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle/migrations");

const VALID_DRAFT = {
  title: "Pre-A1: Phonics — Short sounds",
  teacherNote: "Practice sounding out short words with friendly letter friends.",
  targetVocab: ["cat", "sat", "mat", "pin"],
};

let sqlite: ReturnType<typeof Database>;

beforeEach(() => {
  sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
});

afterEach(() => {
  sqlite.close();
  vi.restoreAllMocks();
});

function makeRepo(userId: string) {
  return new SqliteContentRepository(drizzle(sqlite, { schema }), userId);
}

function kidProfile(): Profile {
  return {
    goals: [],
    createdAt: new Date(0),
    settings: {},
    cefrLevel: "A1",
    experienceMode: "kid",
  };
}

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
    embed: async () => [],
    listModels: async () => [],
  };
}

function makeUnreachableLLM(): LLMClient {
  return {
    chat: (async () => {
      throw new Error("Mac unreachable");
    }) as LLMClient["chat"],
    streamChat: async () =>
      (async function* (): AsyncGenerator<string> {
        yield "";
      })(),
    embed: async () => [],
    listModels: async () => [],
  };
}

describe("shared unit draft prompts (issue #131)", () => {
  it("grounds the prompt with spine + excerpts for the stage", () => {
    const messages = buildSharedUnitDraftMessages("phonics");
    const blob = messages.map((m) => m.content).join("\n");

    expect(blob).toMatch(/Phonics/i);
    expect(blob).toMatch(/GPC|grapheme|phoneme|short/i);
    expect(blob).toMatch(/Starters|paraphrase/i);
    expect(blob).not.toMatch(/redistribute Cambridge wordlists into the JSON/i);

    for (const key of STAGE_DRAFT_GUIDE_KEYS.phonics) {
      // Keys themselves need not appear; section bodies must (via retrieve).
      expect(typeof key).toBe("string");
    }
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.role).toBe("user");
  });
});

describe("draftSharedPathUnit — success", () => {
  it("writes a shared pending ai-draft and never a learner Unit row", async () => {
    const admin = makeRepo("admin");
    const learner = makeRepo("learner-a");
    await ensureSharedPathCatalogSeeded(admin);
    await ensurePath(learner, kidProfile());

    const unitsBefore = await learner.getUnits();
    const template = await draftSharedPathUnit(admin, makeSequentialLLM([VALID_DRAFT]), "phonics");

    expect(template.approvalStatus).toBe("pending");
    expect(template.provenance).toBe("ai-draft");
    expect(template.richness).toBe("rich");
    expect(template.stageId).toBe("phonics");
    expect(template.title).toBe(VALID_DRAFT.title);
    expect(template.targetVocab).toEqual(VALID_DRAFT.targetVocab);
    expect(template.activities).toEqual([{ skill: "phonics" }]);
    expect(() => SharedUnitDraftSchema.parse(VALID_DRAFT)).not.toThrow();

    const pending = await admin.querySharedPathUnitTemplates({ approvalStatus: "pending" });
    expect(pending.some((t) => t.id === template.id)).toBe(true);

    // Approved catalog unchanged — invalid/pending never materializes.
    const approved = await learner.querySharedPathUnitTemplates({ approvalStatus: "approved" });
    expect(approved.some((t) => t.id === template.id)).toBe(false);
    expect(materializePreA1UnitsFromCatalog(approved).some((u) => u.title === template.title)).toBe(
      false,
    );

    const unitsAfter = await learner.getUnits();
    expect(unitsAfter.map((u: Unit) => u.id).sort()).toEqual(
      unitsBefore.map((u: Unit) => u.id).sort(),
    );
    expect(unitsAfter.some((u) => u.title === template.title)).toBe(false);
  });

  it("allocates unique pathIndex and next stageOrder", async () => {
    const admin = makeRepo("admin");
    await ensureSharedPathCatalogSeeded(admin);
    const existing = await admin.querySharedPathUnitTemplates();
    const expectedOrder = nextStageOrder(existing, "picture-words");
    const expectedIndex = allocateUniquePathIndex(existing);

    const template = await draftSharedPathUnit(
      admin,
      makeSequentialLLM([
        {
          title: "Pre-A1: Picture words — Pets",
          teacherNote: "Match pet pictures to short words.",
          targetVocab: ["dog", "cat", "bird"],
        },
      ]),
      "picture-words",
    );

    expect(template.stageOrder).toBe(expectedOrder);
    expect(template.pathIndex).toBe(expectedIndex);
  });
});

describe("draftSharedPathUnit — corrective retry and failure", () => {
  it("retries on malformed Zod output, then persists a valid pending draft", async () => {
    const chatSpy = vi
      .fn()
      .mockResolvedValueOnce({ title: "missing fields" })
      .mockResolvedValueOnce(VALID_DRAFT);
    const llm: LLMClient = {
      chat: (async <T>(_msgs: ChatMessage[], opts?: ChatOptions | ChatObjectOptions<T>) => {
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

    const admin = makeRepo("admin");
    await ensureSharedPathCatalogSeeded(admin);
    const template = await draftSharedPathUnit(admin, llm, "phonics");

    expect(chatSpy).toHaveBeenCalledTimes(2);
    expect(template.approvalStatus).toBe("pending");
    expect(template.title).toBe(VALID_DRAFT.title);

    const approved = await admin.querySharedPathUnitTemplates({ approvalStatus: "approved" });
    expect(approved.some((t) => t.id === template.id)).toBe(false);
  });

  it("throws and writes nothing when the model keeps failing Zod", async () => {
    const admin = makeRepo("admin");
    await ensureSharedPathCatalogSeeded(admin);
    const before = await admin.querySharedPathUnitTemplates({ approvalStatus: "pending" });

    await expect(
      draftSharedPathUnit(admin, makeSequentialLLM([{ title: "bad" }]), "listen-tap"),
    ).rejects.toBeInstanceOf(SharedUnitDraftError);

    const after = await admin.querySharedPathUnitTemplates({ approvalStatus: "pending" });
    expect(after).toHaveLength(before.length);
  });

  it("throws when the Mac / provider is unreachable", async () => {
    const admin = makeRepo("admin");
    await ensureSharedPathCatalogSeeded(admin);

    await expect(
      draftSharedPathUnit(admin, makeUnreachableLLM(), "phonics"),
    ).rejects.toBeInstanceOf(SharedUnitDraftError);
  });
});

describe("fillThinSharedPathStages — shared pending only", () => {
  it("needs densification only when a later stage has no rich approved and no pending", () => {
    const placeholderOnly: SharedPathUnitTemplate[] = [
      {
        id: "pre-a1.phonics.placeholder",
        tier: "pre-A1",
        stageId: "phonics",
        stageOrder: 0,
        pathIndex: -3,
        title: "Pre-A1: Phonics",
        teacherNote: "Placeholder",
        activities: [{ skill: "phonics" }],
        richness: "placeholder",
        approvalStatus: "approved",
        provenance: "human",
        targetVocab: [],
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ];
    expect(stageNeedsSharedDensification(placeholderOnly, "phonics")).toBe(true);

    const withPending = [
      ...placeholderOnly,
      {
        ...placeholderOnly[0]!,
        id: "pending",
        pathIndex: -30,
        richness: "rich" as const,
        approvalStatus: "pending" as const,
        provenance: "ai-draft" as const,
      },
    ];
    expect(stageNeedsSharedDensification(withPending, "phonics")).toBe(false);

    const withRich = [
      {
        ...placeholderOnly[0]!,
        id: "rich",
        pathIndex: -31,
        richness: "rich" as const,
        approvalStatus: "approved" as const,
      },
    ];
    expect(stageNeedsSharedDensification(withRich, "phonics")).toBe(false);
  });

  it("enqueues shared pending drafts for thin later stages and never learner units", async () => {
    const admin = makeRepo("admin");
    const learner = makeRepo("learner-b");
    await ensureSharedPathCatalogSeeded(admin);
    await ensurePath(learner, kidProfile());
    const unitsBefore = await learner.getUnits();

    const drafts = [
      VALID_DRAFT,
      {
        title: "Pre-A1: Picture words — Food",
        teacherNote: "Match food pictures to words.",
        targetVocab: ["apple", "bread", "milk"],
      },
      {
        title: "Pre-A1: Listen & tap — Names",
        teacherNote: "Listen and tap the matching word.",
        targetVocab: ["mom", "dad", "bag"],
      },
    ];
    const result = await fillThinSharedPathStages(admin, makeSequentialLLM(drafts), {
      maxDrafts: 3,
    });

    expect(result.drafted).toHaveLength(3);
    expect(result.drafted.every((t) => t.approvalStatus === "pending")).toBe(true);
    expect(result.drafted.every((t) => t.provenance === "ai-draft")).toBe(true);
    expect(result.drafted.map((t) => t.stageId).sort()).toEqual([
      "listen-tap",
      "phonics",
      "picture-words",
    ]);

    const pending = await learner.querySharedPathUnitTemplates({ approvalStatus: "pending" });
    expect(pending).toHaveLength(3);

    const unitsAfter = await learner.getUnits();
    expect(unitsAfter.map((u) => u.id).sort()).toEqual(unitsBefore.map((u) => u.id).sort());
  });

  it("skips stages that already have pending drafts", async () => {
    const admin = makeRepo("admin");
    await ensureSharedPathCatalogSeeded(admin);
    await draftSharedPathUnit(admin, makeSequentialLLM([VALID_DRAFT]), "phonics");

    const result = await fillThinSharedPathStages(
      admin,
      makeSequentialLLM([
        {
          title: "Pre-A1: Picture words — Colours",
          teacherNote: "Match colour words to pictures.",
          targetVocab: ["red", "blue", "green"],
        },
        {
          title: "Pre-A1: Listen & tap — Animals",
          teacherNote: "Listen and tap the animal.",
          targetVocab: ["dog", "cat", "bird"],
        },
      ]),
      { maxDrafts: 3 },
    );

    expect(result.skippedStages).toContain("phonics");
    expect(result.drafted.map((t) => t.stageId).sort()).toEqual(["listen-tap", "picture-words"]);
  });
});

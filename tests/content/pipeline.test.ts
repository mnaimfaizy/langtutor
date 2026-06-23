import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import type { CefrData } from "@/lib/lexicon";
import { LocalContentValidator } from "@/lib/content/content-validator";
import { generateContent } from "@/lib/content/pipeline";
import type { LLMClient } from "@/lib/llm/llm-client";
import type { ChatMessage, ChatObjectOptions, ChatOptions } from "@/lib/llm/types";

// ── schema used throughout ────────────────────────────────────────────────────

const PassageSchema = z.object({ body: z.string() });
type Passage = z.infer<typeof PassageSchema>;

// ── CEFR fixture ──────────────────────────────────────────────────────────────

const CEFR: CefrData = {
  // A1
  she: "A1",
  goes: "A1",
  the: "A1",
  store: "A1",
  every: "A1",
  day: "A1",
  // A2
  usually: "A2",
  // C1 — the "bad" word that should trigger a retry
  exacerbate: "C1",
  exacerbates: "C1",
};

// ── mock LLM factory ──────────────────────────────────────────────────────────
// Returns a sequential mock: each call pops the next response from the queue;
// once exhausted, the last response is repeated.

function makeSequentialLLM(responses: unknown[]): LLMClient {
  let idx = 0;
  return {
    // The overload cast satisfies the interface's dual-signature without losing types
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

// ── test lifecycle ────────────────────────────────────────────────────────────

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

beforeEach(() => {
  db = new LangTutorDB(`pipeline-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
});

const validator = new LocalContentValidator(CEFR);

const BASE_OPTS = {
  messages: [{ role: "user" as const, content: "Write an A2 passage about shopping." }],
  level: "A2" as const,
  schema: PassageSchema,
  textField: "body" as const,
  type: "passage" as const,
  topic: "shopping",
};

// ── happy path ────────────────────────────────────────────────────────────────

describe("happy path (first attempt succeeds)", () => {
  it("returns parsed content and caches it in the repository", async () => {
    const llm = makeSequentialLLM([
      { body: "She goes to the store every day." }, // clean A2 text
    ]);

    const result = await generateContent(BASE_OPTS, llm, validator, repo);

    expect(result.parsed.body).toBe("She goes to the store every day.");
    expect(typeof result.contentId).toBe("number");

    const cached = await repo.getContent(result.contentId);
    expect(cached).toBeDefined();
    expect(cached?.level).toBe("A2");
    expect(cached?.topic).toBe("shopping");
    expect(cached?.source).toBe("generated");
    expect(cached?.payload).toMatchObject({ body: "She goes to the store every day." });
  });

  it("only calls the LLM once when the first response is valid", async () => {
    const chatSpy = vi.fn().mockResolvedValue({ body: "She goes to the store." });
    const llm = {
      chat: chatSpy as LLMClient["chat"],
      streamChat: async () =>
        (async function* () {
          yield "";
        })(),
      embed: async (t: string[]) => t.map(() => [0]),
      listModels: async () => [],
    };

    await generateContent(BASE_OPTS, llm, validator, repo);
    expect(chatSpy).toHaveBeenCalledTimes(1);
  });
});

// ── retry on validation failure ───────────────────────────────────────────────

describe("corrective retry on validation failure", () => {
  it("retries when the LLM returns over-level text, then succeeds", async () => {
    const llm = makeSequentialLLM([
      { body: "The scientist exacerbates the problem." }, // C1 word → fail
      { body: "She goes to the store every day." }, // A2 text → pass
    ]);

    const result = await generateContent(BASE_OPTS, llm, validator, repo);
    expect(result.parsed.body).toBe("She goes to the store every day.");
    expect(typeof result.contentId).toBe("number");
  });

  it("makes exactly two LLM calls on a single-retry success", async () => {
    const chatSpy = vi
      .fn()
      .mockResolvedValueOnce({ body: "The scientist exacerbates the problem." })
      .mockResolvedValueOnce({ body: "She goes to the store every day." });

    const llm = {
      chat: chatSpy as LLMClient["chat"],
      streamChat: async () =>
        (async function* () {
          yield "";
        })(),
      embed: async (t: string[]) => t.map(() => [0]),
      listModels: async () => [],
    };
    await generateContent(BASE_OPTS, llm, validator, repo);
    expect(chatSpy).toHaveBeenCalledTimes(2);
  });

  it("corrective call includes more messages than the first call", async () => {
    const capturedMessages: ChatMessage[][] = [];
    const chat = vi
      .fn()
      .mockImplementation(async (msgs: ChatMessage[], opts: ChatObjectOptions<Passage>) => {
        capturedMessages.push([...msgs]);
        if (capturedMessages.length === 1)
          return opts.schema.parse({ body: "The scientist exacerbates the problem." });
        return opts.schema.parse({ body: "She goes to the store every day." });
      });

    await generateContent(
      BASE_OPTS,
      {
        chat: chat as LLMClient["chat"],
        streamChat: async () =>
          (async function* () {
            yield "";
          })(),
        embed: async (t: string[]) => t.map(() => [0]),
        listModels: async () => [],
      },
      validator,
      repo,
    );

    // Second call must have more messages (original + assistant response + correction)
    expect(capturedMessages[1].length).toBeGreaterThan(capturedMessages[0].length);
  });

  it("corrective message names the offending word", async () => {
    const capturedMessages: ChatMessage[][] = [];
    const chat = vi
      .fn()
      .mockImplementation(async (msgs: ChatMessage[], opts: ChatObjectOptions<Passage>) => {
        capturedMessages.push([...msgs]);
        if (capturedMessages.length === 1)
          return opts.schema.parse({ body: "The scientist exacerbates the problem." });
        return opts.schema.parse({ body: "She goes to the store every day." });
      });

    await generateContent(
      BASE_OPTS,
      {
        chat: chat as LLMClient["chat"],
        streamChat: async () =>
          (async function* () {
            yield "";
          })(),
        embed: async (t: string[]) => t.map(() => [0]),
        listModels: async () => [],
      },
      validator,
      repo,
    );

    const corrective = capturedMessages[1].at(-1);
    expect(corrective?.role).toBe("user");
    expect(corrective?.content).toMatch(/exacerbates/i);
  });
});

// ── max retries exceeded ──────────────────────────────────────────────────────

describe("max retries exceeded", () => {
  it("throws after maxRetries + 1 failed attempts", async () => {
    const llm = makeSequentialLLM([
      { body: "The scientist exacerbates the problem." }, // always C1
    ]);

    await expect(
      generateContent({ ...BASE_OPTS, maxRetries: 2 }, llm, validator, repo),
    ).rejects.toThrow(/failed after 3 attempt/i);
  });

  it("makes exactly maxRetries + 1 LLM calls before throwing", async () => {
    const chatSpy = vi.fn().mockResolvedValue({ body: "The scientist exacerbates the problem." });

    const llm = {
      chat: chatSpy as LLMClient["chat"],
      streamChat: async () =>
        (async function* () {
          yield "";
        })(),
      embed: async (t: string[]) => t.map(() => [0]),
      listModels: async () => [],
    };

    await expect(
      generateContent({ ...BASE_OPTS, maxRetries: 2 }, llm, validator, repo),
    ).rejects.toThrow();

    expect(chatSpy).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("nothing is cached on total failure", async () => {
    const llm = makeSequentialLLM([{ body: "The scientist exacerbates the problem." }]);

    await expect(
      generateContent({ ...BASE_OPTS, maxRetries: 1 }, llm, validator, repo),
    ).rejects.toThrow();

    const all = await repo.queryContent();
    expect(all).toHaveLength(0);
  });
});

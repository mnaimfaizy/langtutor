import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { LLMClient } from "@/lib/llm";
import { MockLLMClient } from "@/lib/llm/mock-llm-client";

const messages = [{ role: "user", content: "hi" }] as const;

describe("MockLLMClient (offline seam)", () => {
  it("returns plain text for a text chat", async () => {
    const client: LLMClient = new MockLLMClient({ text: "hello there" });
    expect(await client.chat([...messages])).toBe("hello there");
  });

  it("returns a Zod-validated object for a schema chat", async () => {
    const schema = z.object({ answer: z.string(), score: z.number() });
    const client: LLMClient = new MockLLMClient({ object: { answer: "42", score: 1 } });

    const result = await client.chat([...messages], { schema });

    expect(result).toEqual({ answer: "42", score: 1 });
    // `result` is typed as { answer: string; score: number } via the schema overload.
    expect(result.answer).toBe("42");
  });

  it("throws when the configured object violates the schema", async () => {
    const schema = z.object({ answer: z.string() });
    const client = new MockLLMClient({ object: { answer: 123 } });

    await expect(client.chat([...messages], { schema })).rejects.toThrow();
  });

  it("streams chunks that reassemble to the full message", async () => {
    const client = new MockLLMClient({ text: "one two three" });

    const stream = await client.streamChat([...messages]);
    let out = "";
    for await (const chunk of stream) out += chunk;

    expect(out).toBe("one two three");
  });

  it("embeds each text (row-aligned) and lists models", async () => {
    const client = new MockLLMClient({
      embedding: (text) => [text.length, 0],
      models: ["m1", "m2"],
    });

    expect(await client.embed(["ab", "cde"])).toEqual([
      [2, 0],
      [3, 0],
    ]);
    expect(await client.listModels()).toEqual(["m1", "m2"]);
  });
});

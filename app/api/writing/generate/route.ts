import { z } from "zod";

import type { Cefr } from "@/lib/db";
import { NullContentRepository, NullContentValidator } from "@/lib/content/null-adapters";
import { buildPromptMessages, PromptSchema } from "@/lib/content/prompt";
import { generateContent } from "@/lib/content/pipeline";
import { getLLMClient } from "@/lib/llm/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  topic: z.string().min(1).max(200),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"] as const satisfies readonly Cefr[]),
});

/**
 * `POST /api/writing/generate` — generate a writing prompt.
 * Body: `{ topic: string, level: Cefr }`
 * Response: `{ prompt: { title: string, instruction: string, context?: string } }`
 *
 * Schema validation only (NullContentValidator) — prompts are teacher-voice instructions
 * and intentionally bypass CEFR word/grammar gating. Caching to IndexedDB happens on the
 * client after it receives the response.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { topic, level } = parsed.data;

  try {
    const llmClient = await getLLMClient();
    const validator = new NullContentValidator();
    const repo = new NullContentRepository();

    const result = await generateContent(
      {
        messages: buildPromptMessages(topic, level),
        level,
        schema: PromptSchema,
        textField: "instruction",
        type: "prompt",
        topic,
      },
      llmClient,
      validator,
      repo,
    );

    return Response.json({ prompt: result.parsed });
  } catch (error) {
    console.error("[api/writing/generate]", error);
    return Response.json({ error: "Failed to generate prompt" }, { status: 502 });
  }
}

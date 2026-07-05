import { z } from "zod";

import type { Cefr } from "@/lib/db";
import { NullContentRepository } from "@/lib/content/null-adapters";
import { LocalContentValidator } from "@/lib/content/content-validator";
import type { ContentValidator } from "@/lib/content/content-validator";
import { buildPassageMessages, PassageSchema } from "@/lib/content/passage";
import { generateContent } from "@/lib/content/pipeline";
import { loadCefrData } from "@/lib/lexicon/data-loader";
import { getLLMClient } from "@/lib/llm/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RequestSchema = z.object({
  topic: z.string().min(1).max(200),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"] as const satisfies readonly Cefr[]),
});

// Module-level singleton — cefrData is loaded once from disk on first generation request.
let _validator: ContentValidator | undefined;

function getValidator(): ContentValidator {
  if (!_validator) {
    _validator = new LocalContentValidator(loadCefrData());
  }
  return _validator;
}

/**
 * `POST /api/reading/generate` — generate a CEFR-valid reading passage.
 * Body: `{ topic: string, level: Cefr }`
 * Response: `{ passage: { title: string, body: string } }`
 *
 * The passage is validated by the pipeline (word + grammar CEFR gate, corrective retries).
 * Caching to IndexedDB happens on the client after it receives the response.
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
    const validator = getValidator();
    const repo = new NullContentRepository();

    const result = await generateContent(
      {
        messages: buildPassageMessages(topic, level),
        level,
        schema: PassageSchema,
        textField: "body",
        type: "passage",
        topic,
      },
      llmClient,
      validator,
      repo,
    );

    return Response.json({ passage: result.parsed });
  } catch (error) {
    console.error("[api/reading/generate]", error);
    return Response.json({ error: "Failed to generate passage" }, { status: 502 });
  }
}

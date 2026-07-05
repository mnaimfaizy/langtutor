import { z } from "zod";

import type { Cefr } from "@/lib/db";
import { buildFeedbackMessages, FeedbackSchema } from "@/lib/content/feedback";
import { getLLMClient } from "@/lib/llm/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RequestSchema = z.object({
  draft: z.string().min(1).max(4000),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"] as const satisfies readonly Cefr[]),
});

/**
 * `POST /api/writing/feedback` — return structured corrections for a writing draft.
 * Body: `{ draft: string, level: Cefr }`
 * Response: `{ feedback: FeedbackPayload }`
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

  const { draft, level } = parsed.data;

  try {
    const llmClient = await getLLMClient();
    const raw = await llmClient.chat(buildFeedbackMessages(draft, level), {
      schema: FeedbackSchema,
    });
    const feedback = FeedbackSchema.parse(raw);
    return Response.json({ feedback });
  } catch (error) {
    console.error("[api/writing/feedback]", error);
    return Response.json({ error: "Failed to get feedback" }, { status: 502 });
  }
}

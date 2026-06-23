import { z } from "zod";

import { researchWord } from "@/lib/agent/research-word";
import { getLLMClient } from "@/lib/llm/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  word: z.string().min(1).max(100),
});

/**
 * `POST /api/agent/research-word`
 *
 * LLM-backed fallback for words absent from the WordNet bundle.
 * Body: `{ word: string }`
 * Response: `DefineFound` JSON (same shape as `/api/lexicon/define`)
 * 502 when the Mac is unreachable.
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
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const llmClient = await getLLMClient();
    const result = await researchWord(parsed.data.word, llmClient);
    return Response.json(result);
  } catch (error) {
    console.error("[api/agent/research-word]", error);
    return Response.json({ error: "Agent unavailable" }, { status: 502 });
  }
}

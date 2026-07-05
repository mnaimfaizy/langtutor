import { z } from "zod";

import { getLLMClient } from "@/lib/llm/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

// Bounds cap memory/forwarded payload (basic DoS guard for the no-auth local proxy).
const EmbeddingsRequest = z.object({
  texts: z.array(z.string().max(10_000)).min(1).max(256),
});

/**
 * `POST /api/llm/embeddings` — same-origin proxy to the active embeddings provider.
 * Provider is resolved server-side from runtime/env config (Mac in local mode,
 * Mistral in cloud mode). Returns `{ embeddings }`, row-aligned with `texts`.
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

  const parsed = EmbeddingsRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const client = await getLLMClient();
    const embeddings = await client.embed(parsed.data.texts);
    return Response.json({ embeddings });
  } catch (error) {
    console.error("[api/llm/embeddings]", error);
    return Response.json({ error: "Embedding request failed" }, { status: 502 });
  }
}

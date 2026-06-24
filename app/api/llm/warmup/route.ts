import { getLLMClient } from "@/lib/llm/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

/**
 * `POST /api/llm/warmup` — sends a minimal chat completion to pre-load the model
 * into VRAM so the user's first content generation feels instant. Fire-and-forget
 * from `SettingsBootstrap`; the response is discarded by the caller.
 * Origin-guarded (same profile as other state-changing LLM proxy routes).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const client = await getLLMClient();
    await client.chat([{ role: "user", content: "ping" }]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

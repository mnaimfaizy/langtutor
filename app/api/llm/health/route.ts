import { getLLMClient } from "@/lib/llm/server";

// Always hit the Mac live — never serve a cached health result.
export const dynamic = "force-dynamic";

/**
 * `GET /api/llm/health` — pings the Mac (Ollama) and returns its advertised model list.
 * 200 `{ ok: true, models }` when reachable; 503 `{ ok: false, error }` otherwise. The Mac
 * endpoint stays server-side; the browser only ever sees this same-origin route (PLAN §2.1).
 */
export async function GET() {
  try {
    const client = await getLLMClient();
    const models = await client.listModels();
    return Response.json({ ok: true, models });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Mac unreachable" },
      { status: 503 },
    );
  }
}

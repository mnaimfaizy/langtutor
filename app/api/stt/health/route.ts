import { getRuntimeSttUrl } from "@/lib/transcriber/runtime-config";

export const dynamic = "force-dynamic";

const DEFAULT_STT_URL = "http://localhost:8080";

/**
 * `GET /api/stt/health` — probes the configured whisper.cpp server's `/health` endpoint.
 * whisper.cpp ships with `GET /health` returning `{"status":"ok"}`. Returns
 * `{ ok: true }` on success, `{ ok: false, error }` when unreachable.
 * No origin guard needed — read-only, no state change.
 */
export async function GET() {
  const base = getRuntimeSttUrl() ?? process.env.MAC_STT_URL ?? DEFAULT_STT_URL;
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: `Status ${res.status}` });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unreachable",
    });
  }
}

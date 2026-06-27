import { getRuntimeSttUrl } from "@/lib/transcriber/runtime-config";

export const dynamic = "force-dynamic";

const DEFAULT_STT_URL = "http://localhost:8080";

export async function GET() {
  const base = getRuntimeSttUrl() ?? process.env.MAC_STT_URL ?? DEFAULT_STT_URL;
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      return Response.json({ ok: true });
    }
    console.error(`[stt/health] probe returned HTTP ${res.status}`);
    return Response.json({ ok: false, error: "Service unavailable" }, { status: 503 });
  } catch (error) {
    console.error("[stt/health] probe failed:", error);
    return Response.json({ ok: false, error: "Service unavailable" }, { status: 503 });
  }
}

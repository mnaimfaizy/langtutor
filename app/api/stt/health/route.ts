import { getGroqApiKey, GROQ_OPENAI_BASE_URL } from "@/lib/ai/groq";
import { getRuntimeSttProvider, getRuntimeSttUrl } from "@/lib/transcriber/runtime-config";

export const dynamic = "force-dynamic";

const DEFAULT_STT_URL = "http://localhost:8080";

export async function GET() {
  const provider = getRuntimeSttProvider() ?? "mac";

  if (provider === "groq") {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return Response.json({ ok: false, error: "GROQ_API_KEY not configured" }, { status: 503 });
    }

    try {
      const res = await fetch(`${GROQ_OPENAI_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return Response.json({ ok: true });
      }
      console.error(`[stt/health] Groq probe returned HTTP ${res.status}`);
      return Response.json({ ok: false, error: "Service unavailable" }, { status: 503 });
    } catch (error) {
      console.error("[stt/health] Groq probe failed:", error);
      return Response.json({ ok: false, error: "Service unavailable" }, { status: 503 });
    }
  }

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

import { z } from "zod";

import { setRuntimeSttUrl } from "@/lib/transcriber/runtime-config";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

const SttConfigSchema = z.object({
  sttUrl: z.url().optional(),
});

/**
 * `POST /api/stt/config` — set the server-held STT URL override so transcription calls
 * route to the user's chosen whisper.cpp server. Origin-guarded (same single-user /
 * local risk profile as `POST /api/llm/config`).
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

  const parsed = SttConfigSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  setRuntimeSttUrl(parsed.data.sttUrl);
  return Response.json({ ok: true });
}

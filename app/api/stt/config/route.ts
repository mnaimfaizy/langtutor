import { z } from "zod";

import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { setRuntimeSttUrl } from "@/lib/transcriber/runtime-config";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

const SttConfigSchema = z.object({
  sttUrl: z.url().max(2048).optional(),
});

/**
 * `POST /api/stt/config` — set the server-held STT URL override so transcription calls
 * route to the user's chosen whisper.cpp server. Requires an admin session.
 * Also origin-guarded to block cross-origin callers.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await resolveCurrentUser();
  if (!user || user.role !== "admin") {
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

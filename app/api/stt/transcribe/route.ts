import { getTranscriber } from "@/lib/transcriber/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * `POST /api/stt/transcribe` — same-origin proxy to the Mac whisper-server. Accepts a
 * multipart form with an `audio` field (Blob). Returns `{ transcript }` on success;
 * 502 when the Mac is unreachable or returns an error. The Mac STT endpoint stays
 * server-side; the browser only ever calls this same-origin route (PLAN §2.1).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audioEntry = formData.get("audio");
  if (!(audioEntry instanceof Blob)) {
    return Response.json({ error: "Missing audio field" }, { status: 400 });
  }

  if (audioEntry.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "Audio too large" }, { status: 413 });
  }

  try {
    const transcriber = getTranscriber();
    const transcript = await transcriber.transcribe(audioEntry);
    return Response.json({ transcript });
  } catch (error) {
    console.error("[api/stt/transcribe]", error);
    return Response.json({ error: "Mac STT server not reachable" }, { status: 502 });
  }
}

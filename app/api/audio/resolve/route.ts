import { z } from "zod";

import { getServerContentRepository } from "@/lib/db/server";
import { resolveWordAudio } from "@/lib/tts/resolve-word-audio";
import { getTtsSynthesizer } from "@/lib/tts/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ResolveQuery = z.object({
  word: z.string().trim().min(1).max(100),
  style: z.string().trim().min(1).max(64).optional(),
});

/**
 * `GET /api/audio/resolve?word=<word>&style=<style>`
 *
 * Resolves spoken audio for a word/phrase from the shared media store (ADR 0016).
 * On a store miss, synthesizes via the server-only `TtsSynthesizer` seam, persists
 * the result, and returns the audio bytes. Repeat requests are served from the store.
 */
export async function GET(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = ResolveQuery.safeParse({
    word: url.searchParams.get("word") ?? "",
    style: url.searchParams.get("style") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { word, style } = parsed.data;

  try {
    const repo = await getServerContentRepository();
    const synthesizer = await getTtsSynthesizer();
    const asset = await resolveWordAudio(repo, synthesizer, word, style);

    return new Response(Buffer.from(asset.data), {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[api/audio/resolve]", error);
    return Response.json({ error: "Audio resolution failed" }, { status: 502 });
  }
}

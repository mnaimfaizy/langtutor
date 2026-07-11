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
 * a pending truncated clip (ADR 0028 / 0030), and returns bytes only once approved.
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
    // Lazy factory: approved/pending store hits must not require GROQ_API_KEY.
    const asset = await resolveWordAudio(repo, () => getTtsSynthesizer(), word, style);
    if (!asset) {
      return Response.json({ error: "Audio not available" }, { status: 404 });
    }

    return new Response(Buffer.from(asset.data), {
      headers: {
        "Content-Type": asset.mimeType,
        // Approval/regenerate can replace bytes at this URL — never immutable-cache.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/audio/resolve]", error);
    return Response.json({ error: "Audio resolution failed" }, { status: 502 });
  }
}

import { z } from "zod";

import { getServerContentRepository } from "@/lib/db/server";
import { resolveWordImage } from "@/lib/image/resolve-word-image";
import { getImageGenerator } from "@/lib/image/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ResolveQuery = z.object({
  word: z.string().trim().min(1).max(100),
  style: z.string().trim().min(1).max(64).optional(),
});

/**
 * `GET /api/image/resolve?word=<word>&style=<style>`
 *
 * Resolves a kid-tier word illustration from the shared media store (ADR 0016).
 * On a store miss, generates via the server-only `ImageGenerator` seam, persists
 * the result, and returns the image bytes. Repeat requests are served from the store.
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
    const generator = await getImageGenerator();
    const asset = await resolveWordImage(repo, generator, word, style);

    return new Response(Buffer.from(asset.data), {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[api/image/resolve]", error);
    return Response.json({ error: "Image resolution failed" }, { status: 502 });
  }
}

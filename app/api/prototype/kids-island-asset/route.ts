import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { getImageGenerator } from "@/lib/image/server";
import { isSameOrigin } from "@/lib/server/origin";

import {
  KIDS_ISLAND_ASSETS,
  type KidsIslandAssetId,
} from "../../../home/prototype-kids/island-assets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ASSET_IDS = Object.keys(KIDS_ISLAND_ASSETS) as KidsIslandAssetId[];

const Query = z.object({
  id: z.string().refine((v): v is KidsIslandAssetId => ASSET_IDS.includes(v as KidsIslandAssetId)),
  /** Set to 1 to force a fresh Cloudflare/NIM generation. */
  refresh: z.enum(["0", "1"]).optional(),
});

// Writes directly into the committed, production-serving folder (ADR 0016 "generate once,
// store forever") so a dev regeneration lands exactly where `app/home/kid-island/assets.ts`
// reads from. Review the output before committing — this bypasses normal media-safety review.
const CACHE_DIR = path.join(process.cwd(), "public", "kid-island");

/**
 * Dev-only kid-island art workshop. Generates via the ImageGenerator seam (Cloudflare / NIM)
 * and writes JPEG bytes into `public/kid-island/` for a human to review and commit. Never
 * called at request time in production — the production home reads the committed static
 * files directly (`app/home/kid-island/assets.ts`), with no generation-API surface reachable
 * by real learners.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = Query.safeParse({
    id: url.searchParams.get("id") ?? "",
    refresh: url.searchParams.get("refresh") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id, refresh } = parsed.data;
  const def = KIDS_ISLAND_ASSETS[id];
  const filePath = path.join(CACHE_DIR, `${id}.jpg`);

  if (refresh !== "1") {
    try {
      const cached = await readFile(filePath);
      return new Response(cached, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400",
          "X-Prototype-Cache": "hit",
        },
      });
    } catch {
      // miss — generate below
    }
  }

  try {
    const generator = await getImageGenerator();
    const result = await generator.generate(def.prompt, {
      seed: def.seed,
      steps: 6,
      width: 1024,
      height: 1024,
    });

    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(filePath, result.data);

    return new Response(Buffer.from(result.data), {
      headers: {
        "Content-Type": result.mimeType,
        "Cache-Control": "public, max-age=86400",
        "X-Prototype-Cache": "miss",
      },
    });
  } catch (error) {
    console.error("[api/prototype/kids-island-asset]", id, error);
    return Response.json(
      {
        error: "Image generation failed",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 502 },
    );
  }
}

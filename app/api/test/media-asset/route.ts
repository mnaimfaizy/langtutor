import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import {
  ILLUSTRATION_PACK_STYLE,
  illustrationPackAssetForKey,
} from "@/lib/content/illustration-pack-data";
import { getDrizzleClient } from "@/lib/db/drizzle/client";
import { mediaAssets } from "@/lib/db/drizzle/schema";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Minimal silent-ish WAV header + 1 sample of silence for audio e2e seeds. */
const TINY_WAV = Buffer.from(
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=",
  "base64",
);

const BodySchema = z.object({
  action: z.enum(["put-pending", "put-approved", "restore-pack", "purge"]),
  key: z.string().trim().min(1).max(100),
  kind: z.enum(["image", "audio"]).default("image"),
  style: z.string().trim().min(1).max(64).optional(),
});

/**
 * POST /api/test/media-asset
 *
 * Seeds or restores shared media-store rows for e2e (issue #75 — admin approval gate;
 * issue #110 — admin audio proactive generate).
 * Gated to non-production environments — returns 404 in production.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await requireUser();

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { action, key, kind } = parsed.data;
  const style = parsed.data.style ?? (kind === "audio" ? "default" : ILLUSTRATION_PACK_STYLE);
  const normalized = key.toLowerCase();
  const db = getDrizzleClient();

  const whereKey = and(
    eq(mediaAssets.kind, kind),
    eq(mediaAssets.key, normalized),
    eq(mediaAssets.style, style),
  );

  if (action === "purge") {
    db.delete(mediaAssets).where(whereKey).run();
    return Response.json({ ok: true });
  }

  if (action === "restore-pack") {
    if (kind !== "image") {
      return Response.json({ error: "restore-pack is image-only" }, { status: 400 });
    }
    const asset = illustrationPackAssetForKey(normalized);
    if (!asset) {
      return Response.json({ error: "Not in illustration pack" }, { status: 404 });
    }

    db.insert(mediaAssets)
      .values({
        kind: asset.kind,
        key: asset.key,
        style: asset.style,
        mimeType: asset.mimeType,
        data: Buffer.from(asset.data),
        createdAt: asset.createdAt,
        source: asset.source,
        approvalStatus: asset.approvalStatus,
        prompt: null,
      })
      .onConflictDoUpdate({
        target: [mediaAssets.kind, mediaAssets.key, mediaAssets.style],
        set: {
          mimeType: asset.mimeType,
          data: Buffer.from(asset.data),
          createdAt: asset.createdAt,
          source: asset.source,
          approvalStatus: asset.approvalStatus,
          prompt: null,
        },
      })
      .run();

    return Response.json({ ok: true });
  }

  const approvalStatus = action === "put-approved" ? "approved" : "pending";
  const mimeType = kind === "audio" ? "audio/wav" : "image/png";
  const data = kind === "audio" ? TINY_WAV : TINY_PNG;

  db.insert(mediaAssets)
    .values({
      kind,
      key: normalized,
      style,
      mimeType,
      data,
      createdAt: new Date(),
      source: "generated",
      approvalStatus,
      prompt: null,
    })
    .onConflictDoUpdate({
      target: [mediaAssets.kind, mediaAssets.key, mediaAssets.style],
      set: {
        mimeType,
        data,
        createdAt: new Date(),
        source: "generated",
        approvalStatus,
        prompt: null,
      },
    })
    .run();

  return Response.json({ ok: true });
}

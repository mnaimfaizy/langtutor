"use server";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { getServerContentRepository } from "@/lib/db/server";
import type { MediaAssetApprovalStatus, MediaAssetKey, MediaAssetRecord } from "@/lib/db/schema";
import { resolveKidIllustrationPrompt } from "@/lib/image/prompts";
import { regenerateWordImage } from "@/lib/image/resolve-word-image";
import { getImageGenerator } from "@/lib/image/server";

const MediaAssetKeySchema = z.object({
  kind: z.enum(["image", "audio"]),
  key: z.string().trim().min(1).max(100),
  style: z.string().trim().min(1).max(64),
});

const RegenerateSchema = MediaAssetKeySchema.extend({
  prompt: z.string().max(4000).optional(),
});

export async function listMediaAssets(
  approvalStatus?: MediaAssetApprovalStatus,
): Promise<MediaAssetRecord[]> {
  await requireAdmin();
  const repo = await getServerContentRepository();
  return repo.queryMediaAssets({ kind: "image", approvalStatus });
}

export async function approveMediaAsset(key: MediaAssetKey): Promise<void> {
  await requireAdmin();
  MediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  await repo.approveMediaAsset(key);
}

export async function purgeMediaAsset(key: MediaAssetKey): Promise<void> {
  await requireAdmin();
  MediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  await repo.deleteMediaAsset(key);
}

/**
 * Admin regenerate with optional prompt override (ADR 0023 / 0024).
 * Replaces the row as a pending generated asset with the effective prompt stored.
 */
export async function regenerateMediaAsset(
  key: MediaAssetKey,
  prompt?: string,
): Promise<MediaAssetRecord> {
  await requireAdmin();
  const parsed = RegenerateSchema.parse({ ...key, prompt });
  const repo = await getServerContentRepository();
  const asset = await regenerateWordImage(
    repo,
    () => getImageGenerator(),
    parsed.key,
    parsed.style,
    parsed.prompt,
  );
  const { data: _data, ...record } = asset;
  return record;
}

/** Prior stored prompt, or the default kid-illustration template when missing/curated. */
export async function getRegeneratePromptDraft(key: MediaAssetKey): Promise<string> {
  await requireAdmin();
  const parsed = MediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  const asset = await repo.getMediaAssetRaw(parsed);
  return resolveKidIllustrationPrompt(parsed.key, asset?.prompt);
}

export async function getMediaAssetPreview(key: MediaAssetKey): Promise<string | null> {
  await requireAdmin();
  MediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  const asset = await repo.getMediaAssetRaw(key);
  if (!asset || asset.kind !== "image") return null;
  const base64 = Buffer.from(asset.data).toString("base64");
  return `data:${asset.mimeType};base64,${base64}`;
}

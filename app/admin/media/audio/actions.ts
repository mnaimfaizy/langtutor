"use server";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { getServerContentRepository } from "@/lib/db/server";
import type { MediaAssetApprovalStatus, MediaAssetKey, MediaAssetRecord } from "@/lib/db/schema";
import { estimateWavDurationSeconds } from "@/lib/tts/truncate-audio";

const MediaAssetKeySchema = z.object({
  kind: z.enum(["image", "audio"]),
  key: z.string().trim().min(1).max(100),
  style: z.string().trim().min(1).max(64),
});

export type AudioPreview = {
  dataUrl: string;
  /** Approximate duration in seconds from the WAV header; null when unknown. */
  durationSeconds: number | null;
};

export async function listAudioMediaAssets(
  approvalStatus?: MediaAssetApprovalStatus,
): Promise<MediaAssetRecord[]> {
  await requireAdmin();
  const repo = await getServerContentRepository();
  return repo.queryMediaAssets({ kind: "audio", approvalStatus });
}

export async function approveAudioMediaAsset(key: MediaAssetKey): Promise<void> {
  await requireAdmin();
  MediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  await repo.approveMediaAsset(key);
}

export async function purgeAudioMediaAsset(key: MediaAssetKey): Promise<void> {
  await requireAdmin();
  MediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  await repo.deleteMediaAsset(key);
}

export async function getAudioMediaAssetPreview(key: MediaAssetKey): Promise<AudioPreview | null> {
  await requireAdmin();
  MediaAssetKeySchema.parse(key);
  const repo = await getServerContentRepository();
  const asset = await repo.getMediaAssetRaw(key);
  if (!asset || asset.kind !== "audio") return null;
  const base64 = Buffer.from(asset.data).toString("base64");
  const durationSeconds = asset.mimeType.toLowerCase().includes("wav")
    ? estimateWavDurationSeconds(asset.data)
    : null;
  return {
    dataUrl: `data:${asset.mimeType};base64,${base64}`,
    durationSeconds,
  };
}

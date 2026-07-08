/**
 * Curated pre-A1 illustration pack data (ADR 0016, issue #70). Node-only — reads
 * bundled files from `data/illustration-pack/`. Import from server startup and tests,
 * not from client components.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAsset } from "@/lib/db/schema";

const PACK_DIR = join(process.cwd(), "data/illustration-pack");

const IllustrationPackEntrySchema = z.object({
  key: z.string().min(1),
  file: z.string().min(1),
  mimeType: z.string().min(1),
  artSource: z.enum(["letter-art", "twemoji"]),
  license: z.string().min(1),
  twemojiCodepoint: z.string().optional(),
});

const IllustrationPackManifestSchema = z.object({
  version: z.literal(1),
  style: z.string().min(1),
  createdAt: z.string().datetime(),
  license: z.object({
    summary: z.string(),
    letters: z.object({
      name: z.string(),
      note: z.string(),
    }),
    nouns: z.object({
      name: z.string(),
      note: z.string(),
      url: z.string().url(),
      source: z.string().url(),
    }),
  }),
  entries: z.array(IllustrationPackEntrySchema).min(1),
});

export type IllustrationPackManifest = z.infer<typeof IllustrationPackManifestSchema>;

const PACK_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

let _manifest: IllustrationPackManifest | null = null;

function readPackManifest(): IllustrationPackManifest {
  if (_manifest) return _manifest;

  const raw = readFileSync(join(PACK_DIR, "manifest.json"), "utf8");
  _manifest = IllustrationPackManifestSchema.parse(JSON.parse(raw));
  return _manifest;
}

function readPackEntryData(file: string): Uint8Array {
  const buffer = readFileSync(join(PACK_DIR, "images", file.replace(/^images\//, "")));
  return new Uint8Array(buffer);
}

function packAsset(entry: IllustrationPackManifest["entries"][number], style: string): MediaAsset {
  return {
    kind: "image",
    key: entry.key.toLowerCase(),
    style,
    data: readPackEntryData(entry.file),
    mimeType: entry.mimeType,
    createdAt: PACK_CREATED_AT,
    source: "curated-pack",
    approvalStatus: "approved",
  };
}

/** Kid illustration style used by {@link resolveWordImage}. */
export const ILLUSTRATION_PACK_STYLE = "kid-illustration";

/** Entry count after running `node scripts/build-illustration-pack.mjs`. */
export function illustrationPackEntryCount(): number {
  return readPackManifest().entries.length;
}

/** Load and Zod-parse the bundled pack manifest. */
export function loadIllustrationPackManifest(): IllustrationPackManifest {
  return readPackManifest();
}

/** All pack assets materialized from the bundled manifest. */
export function illustrationPackAssets(): MediaAsset[] {
  const manifest = readPackManifest();
  return manifest.entries.map((entry) => packAsset(entry, manifest.style));
}

/** Build a single pack asset for seeding. */
export function illustrationPackAssetForKey(key: string): MediaAsset | undefined {
  const manifest = readPackManifest();
  const entry = manifest.entries.find((e) => e.key.toLowerCase() === key.toLowerCase());
  if (!entry) return undefined;
  return packAsset(entry, manifest.style);
}

/**
 * Idempotently seed curated-pack images into the shared media store. Skips keys that
 * already have a `curated-pack` asset; never overwrites generated or admin-edited rows.
 */
export async function seedIllustrationPackIfEmpty(repo: ContentRepository): Promise<void> {
  const manifest = readPackManifest();
  const curated = await repo.queryMediaAssets({ kind: "image" });
  const curatedKeys = new Set(
    curated.filter((row) => row.source === "curated-pack").map((row) => row.key),
  );

  if (curatedKeys.size >= manifest.entries.length) return;

  for (const entry of manifest.entries) {
    const normalized = entry.key.toLowerCase();
    if (curatedKeys.has(normalized)) continue;

    const existing = await repo.getMediaAssetRaw({
      kind: "image",
      key: normalized,
      style: manifest.style,
    });
    if (existing?.source === "curated-pack") continue;

    const asset = illustrationPackAssetForKey(normalized);
    if (!asset) continue;
    await repo.putMediaAsset(asset);
  }
}

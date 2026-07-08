import "server-only";

import { and, eq, sql } from "drizzle-orm";

import {
  illustrationPackAssets,
  illustrationPackEntryCount,
} from "@/lib/content/illustration-pack-data";

import type { DrizzleClient } from "./client";
import { mediaAssets } from "./schema";

/**
 * Synchronous curated-pack seed for local SQLite startup (mirrors {@link seedAppConfig}).
 * Idempotent — skips when every pack entry is already present.
 */
export function seedIllustrationPackSync(db: DrizzleClient): void {
  const expected = illustrationPackEntryCount();
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(mediaAssets)
    .where(eq(mediaAssets.source, "curated-pack"))
    .get();
  if ((row?.count ?? 0) >= expected) return;

  for (const asset of illustrationPackAssets()) {
    const existing = db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.kind, asset.kind),
          eq(mediaAssets.key, asset.key),
          eq(mediaAssets.style, asset.style),
        ),
      )
      .get();
    if (existing) continue;

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
      })
      .run();
  }
}

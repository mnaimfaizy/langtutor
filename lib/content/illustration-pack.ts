/**
 * Server re-exports for curated pre-A1 illustration pack seeding (ADR 0016, issue #70).
 */
import "server-only";

export {
  ILLUSTRATION_PACK_STYLE,
  illustrationPackAssets,
  illustrationPackEntryCount,
  loadIllustrationPackManifest,
  seedIllustrationPackIfEmpty,
} from "./illustration-pack-data";
export type { IllustrationPackManifest } from "./illustration-pack-data";

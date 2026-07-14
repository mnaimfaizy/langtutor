/**
 * Admin shared-path review: per-word image/audio readiness for template `targetVocab`
 * (slice 1 of pending-draft review depth).
 *
 * Uses the same default styles as admin media pages (`kid-illustration` / `default`).
 * Learner-ready means `approved`; pending rows still need admin media approval.
 */
import type { ContentRepository } from "@/lib/db/content-repository";
import type { MediaAsset, MediaAssetApprovalStatus } from "@/lib/db/schema";

/** Default image style on `/admin/media`. */
export const SHARED_PATH_IMAGE_STYLE = "kid-illustration";

/** Default audio style on `/admin/media/audio`. */
export const SHARED_PATH_AUDIO_STYLE = "default";

/** Presence of a media asset for one word at the shared-path default style. */
export type SharedPathMediaPresence = "missing" | "pending" | "approved";

export type SharedPathWordMediaStatus = {
  word: string;
  image: SharedPathMediaPresence;
  audio: SharedPathMediaPresence;
  /** Optional kid-facing sense from the shared-path draft (for admin review). */
  sense?: string;
};

export type SharedPathMediaReadinessSummary = {
  wordCount: number;
  /** Words with an approved image at the default style. */
  imagesReady: number;
  /** Words with approved audio at the default style. */
  audioReady: number;
  /**
   * Words where image or audio is not yet learner-ready (missing or pending).
   * Pending counts as needing attention — same spirit as media admin.
   */
  needsAttention: number;
};

function normalizeWord(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Stable unique vocab list for review — first occurrence wins. */
export function normalizeSharedPathTargetVocab(words: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const word = normalizeWord(raw);
    if (!word || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out;
}

/**
 * Target vocab from shared pre-A1 path templates that still matter for media prep
 * (pending + approved). Rejected drafts are omitted so gaps stay actionable.
 */
export async function listSharedPathCatalogVocabulary(
  repo: Pick<ContentRepository, "querySharedPathUnitTemplates">,
): Promise<string[]> {
  const templates = await repo.querySharedPathUnitTemplates({ tier: "pre-A1" });
  const collected: string[] = [];
  for (const template of templates) {
    if (template.approvalStatus === "rejected") continue;
    collected.push(...template.targetVocab);
  }
  return normalizeSharedPathTargetVocab(collected).sort((a, b) => a.localeCompare(b));
}

/**
 * Union of kid-facing senses from pending + approved shared templates.
 * First non-empty sense for a word wins (pending drafts before later approved).
 */
export async function listSharedPathCatalogVocabSenses(
  repo: Pick<ContentRepository, "querySharedPathUnitTemplates">,
): Promise<Record<string, string>> {
  const templates = await repo.querySharedPathUnitTemplates({ tier: "pre-A1" });
  const senses: Record<string, string> = {};
  const ordered = [...templates].sort((a, b) => {
    // Prefer pending (admin reviewing now) then approved; skip rejected.
    const rank = (s: string) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
    return rank(a.approvalStatus) - rank(b.approvalStatus);
  });
  for (const template of ordered) {
    if (template.approvalStatus === "rejected") continue;
    const map = template.targetVocabSenses;
    if (!map) continue;
    for (const [rawWord, sense] of Object.entries(map)) {
      const word = normalizeWord(rawWord);
      const trimmed = sense.trim();
      if (!word || !trimmed || senses[word]) continue;
      senses[word] = trimmed;
    }
  }
  return senses;
}

function presenceFromAsset(
  asset: Pick<MediaAsset, "approvalStatus"> | undefined,
): SharedPathMediaPresence {
  if (!asset) return "missing";
  const status: MediaAssetApprovalStatus = asset.approvalStatus;
  return status === "approved" ? "approved" : "pending";
}

/**
 * For each target-vocab word, report image + audio readiness in the shared media store.
 */
export async function assessSharedPathVocabMedia(
  repo: Pick<ContentRepository, "getMediaAssetRaw">,
  words: readonly string[],
  options?: {
    imageStyle?: string;
    audioStyle?: string;
    senses?: Record<string, string>;
  },
): Promise<SharedPathWordMediaStatus[]> {
  const imageStyle = options?.imageStyle ?? SHARED_PATH_IMAGE_STYLE;
  const audioStyle = options?.audioStyle ?? SHARED_PATH_AUDIO_STYLE;
  const normalized = normalizeSharedPathTargetVocab(words);

  const rows: SharedPathWordMediaStatus[] = [];
  for (const word of normalized) {
    const [imageAsset, audioAsset] = await Promise.all([
      repo.getMediaAssetRaw({ kind: "image", key: word, style: imageStyle }),
      repo.getMediaAssetRaw({ kind: "audio", key: word, style: audioStyle }),
    ]);
    const sense = options?.senses?.[word]?.trim();
    rows.push({
      word,
      image: presenceFromAsset(imageAsset),
      audio: presenceFromAsset(audioAsset),
      ...(sense ? { sense } : {}),
    });
  }
  return rows;
}

/** Roll-up counts for admin list chrome (one line under the vocab chips). */
export function summarizeSharedPathMediaReadiness(
  rows: readonly SharedPathWordMediaStatus[],
): SharedPathMediaReadinessSummary {
  let imagesReady = 0;
  let audioReady = 0;
  let needsAttention = 0;
  for (const row of rows) {
    if (row.image === "approved") imagesReady += 1;
    if (row.audio === "approved") audioReady += 1;
    if (row.image !== "approved" || row.audio !== "approved") needsAttention += 1;
  }
  return {
    wordCount: rows.length,
    imagesReady,
    audioReady,
    needsAttention,
  };
}

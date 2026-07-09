import type { ExperienceMode, MediaAssetKey } from "@/lib/db/schema";

const DECK_WORD_IMAGE_STYLE = "kid-illustration";

/** Layout variant for a deck browser card row. */
export type DeckCardLayout = "text-only" | "picture-first" | "accent";

/** Media store key for a deck card word illustration (approved assets only at read time). */
export function deckWordImageKey(word: string): MediaAssetKey {
  return {
    kind: "image",
    key: word.toLowerCase().trim(),
    style: DECK_WORD_IMAGE_STYLE,
  };
}

/** Same-origin resolve URL for an approved kid-tier deck card illustration. */
export function deckWordImageUrl(word: string): string {
  const normalized = word.toLowerCase().trim();
  return `/api/image/resolve?word=${encodeURIComponent(normalized)}&style=${encodeURIComponent(DECK_WORD_IMAGE_STYLE)}`;
}

/**
 * Chooses the deck browser card layout. Cards without an approved image always use the
 * legacy text-only layout so there is no broken image or layout shift.
 */
export function resolveDeckCardLayout(
  experienceMode: ExperienceMode,
  hasApprovedImage: boolean,
): DeckCardLayout {
  if (!hasApprovedImage) return "text-only";
  return experienceMode === "kid" ? "picture-first" : "accent";
}

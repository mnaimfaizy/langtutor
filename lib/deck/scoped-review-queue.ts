import type { FsrsState } from "@/lib/db";
import type { DeckCardFilters } from "@/lib/deck/filter-deck-cards";
import { getDueCards } from "@/lib/srs";

export interface ScopedReviewCard {
  id: number;
  fsrs: FsrsState;
  suspended?: boolean;
}

/** True when the deck browser has an active filter and/or collection scope. */
export function hasDeckBrowserScopeActive(
  filters: DeckCardFilters,
  collectionFilter: number | null,
  searchQuery: string,
): boolean {
  return (
    collectionFilter !== null ||
    filters.cefr !== null ||
    filters.mastery !== null ||
    filters.due !== null ||
    searchQuery.trim().length > 0
  );
}

/** Due cards from `cards` whose ids appear in `scopedCardIds`, preserving input order. */
export function buildScopedReviewQueue<T extends ScopedReviewCard>(
  cards: T[],
  scopedCardIds: ReadonlySet<number>,
  now = new Date(),
): T[] {
  return getDueCards(
    cards.filter((card) => scopedCardIds.has(card.id)),
    now,
  );
}

/** Parses the `cards` search param from a deck-browser handoff into a scoped id set. */
export function parseScopedReviewCardIds(param: string | null): ReadonlySet<number> | null {
  if (!param?.trim()) return null;

  const ids = param
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (ids.length === 0) return null;
  return new Set(ids);
}

/** Builds the review URL carrying a deck-browser scoped card id list. */
export function scopedReviewHref(cardIds: ReadonlyArray<number>): string {
  if (cardIds.length === 0) return "/review";
  return `/review?cards=${cardIds.join(",")}`;
}

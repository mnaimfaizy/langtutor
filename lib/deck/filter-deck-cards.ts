import type { Cefr } from "@/lib/db";
import type { MasteryLabel } from "@/lib/srs";
import { masteryLabelFromState } from "@/lib/srs";

/** Minimal card shape for deck browser search. */
export interface DeckSearchableCard {
  word: string;
  definition: string;
}

/** Card fields required for CEFR, mastery, and due filters. */
export interface DeckFilterableCard extends DeckSearchableCard {
  cefr: Cefr;
  fsrsState: number;
  dueIso: string;
}

export type DeckDueStatusFilter = "due" | "later";

export interface DeckCardFilters {
  cefr: Cefr | null;
  mastery: MasteryLabel | null;
  due: DeckDueStatusFilter | null;
}

/** Filters cards by case-insensitive substring match on word or definition. */
export function filterDeckCards<T extends DeckSearchableCard>(cards: T[], query: string): T[] {
  const trimmed = query.trim();
  if (!trimmed) return cards;

  const needle = trimmed.toLowerCase();
  return cards.filter(
    (card) =>
      card.word.toLowerCase().includes(needle) || card.definition.toLowerCase().includes(needle),
  );
}

export function filterDeckCardsByCefr<T extends Pick<DeckFilterableCard, "cefr">>(
  cards: T[],
  cefr: Cefr | null,
): T[] {
  if (!cefr) return cards;
  return cards.filter((card) => card.cefr === cefr);
}

export function filterDeckCardsByMastery<T extends Pick<DeckFilterableCard, "fsrsState">>(
  cards: T[],
  mastery: MasteryLabel | null,
): T[] {
  if (!mastery) return cards;
  return cards.filter((card) => masteryLabelFromState(card.fsrsState) === mastery);
}

export function filterDeckCardsByDue<T extends Pick<DeckFilterableCard, "dueIso">>(
  cards: T[],
  due: DeckDueStatusFilter | null,
  now = new Date(),
): T[] {
  if (!due) return cards;
  const nowMs = now.getTime();
  return cards.filter((card) => {
    const isDue = new Date(card.dueIso).getTime() <= nowMs;
    return due === "due" ? isDue : !isDue;
  });
}

/** Applies search and facet filters with AND semantics. */
export function applyDeckCardFilters<T extends DeckFilterableCard>(
  cards: T[],
  filters: DeckCardFilters,
  searchQuery: string,
  now = new Date(),
): T[] {
  let result = filterDeckCards(cards, searchQuery);
  result = filterDeckCardsByCefr(result, filters.cefr);
  result = filterDeckCardsByMastery(result, filters.mastery);
  result = filterDeckCardsByDue(result, filters.due, now);
  return result;
}

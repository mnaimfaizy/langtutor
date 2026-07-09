/** Minimal card shape for deck browser sorting. */
export interface DeckSortableCard {
  id: number;
  word: string;
  dueIso: string;
  createdAtIso: string;
  lastReviewIso?: string;
}

export type DeckSortMode = "due" | "recency" | "alphabet";

function compareWords(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

/** Soonest due first; ties break alphabetically by word. */
export function compareDeckCardsByDue(a: DeckSortableCard, b: DeckSortableCard): number {
  const dueDiff = new Date(a.dueIso).getTime() - new Date(b.dueIso).getTime();
  if (dueDiff !== 0) return dueDiff;
  return compareWords(a.word, b.word);
}

function deckCardTouchedAtMs(
  card: Pick<DeckSortableCard, "createdAtIso" | "lastReviewIso">,
): number {
  const createdMs = new Date(card.createdAtIso).getTime();
  const reviewedMs = card.lastReviewIso ? new Date(card.lastReviewIso).getTime() : 0;
  return Math.max(createdMs, reviewedMs);
}

/** Most recently added or reviewed first; ties break alphabetically by word. */
export function compareDeckCardsByRecency(a: DeckSortableCard, b: DeckSortableCard): number {
  const recencyDiff = deckCardTouchedAtMs(b) - deckCardTouchedAtMs(a);
  if (recencyDiff !== 0) return recencyDiff;
  return compareWords(a.word, b.word);
}

/** Alphabetical by word; ties break by card id. */
export function compareDeckCardsByAlphabet(a: DeckSortableCard, b: DeckSortableCard): number {
  const wordDiff = compareWords(a.word, b.word);
  if (wordDiff !== 0) return wordDiff;
  return a.id - b.id;
}

const COMPARATORS: Record<DeckSortMode, (a: DeckSortableCard, b: DeckSortableCard) => number> = {
  due: compareDeckCardsByDue,
  recency: compareDeckCardsByRecency,
  alphabet: compareDeckCardsByAlphabet,
};

/** Returns a new array sorted by the selected mode. */
export function sortDeckCards<T extends DeckSortableCard>(cards: T[], mode: DeckSortMode): T[] {
  return [...cards].sort(COMPARATORS[mode]);
}

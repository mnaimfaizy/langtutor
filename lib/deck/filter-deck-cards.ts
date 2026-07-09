/** Minimal card shape for deck browser search. */
export interface DeckSearchableCard {
  word: string;
  definition: string;
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

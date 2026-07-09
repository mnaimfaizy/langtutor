import type { Card } from "@/lib/db";
import { repoGetAllCards } from "@/lib/db/content-actions";

import { DeckClient, type DeckCardItem } from "./deck-client";

export const metadata = { title: "Deck — Lang-Tutor" };
export const dynamic = "force-dynamic";

function toDeckCardItem(card: Card): DeckCardItem {
  return {
    id: card.id,
    word: card.word,
    definition: card.definition,
    cefr: card.cefr,
    fsrsState: card.fsrs.state,
    dueIso: card.fsrs.due.toISOString(),
    suspended: card.suspended,
  };
}

export default async function DeckPage() {
  const cards = await repoGetAllCards();
  const items = cards
    .map(toDeckCardItem)
    .sort((a, b) => a.word.localeCompare(b.word, undefined, { sensitivity: "base" }));

  return <DeckClient initialCards={items} />;
}

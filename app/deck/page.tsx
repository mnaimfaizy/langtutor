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
    examples: card.examples,
    cefr: card.cefr,
    fsrsState: card.fsrs.state,
    dueIso: card.fsrs.due.toISOString(),
    createdAtIso: card.createdAt.toISOString(),
    lastReviewIso: card.fsrs.lastReview?.toISOString(),
    suspended: card.suspended,
  };
}

export default async function DeckPage() {
  const cards = await repoGetAllCards();
  const items = cards.map(toDeckCardItem);

  return <DeckClient initialCards={items} />;
}

import type { Card } from "@/lib/db";
import { deckWordImageKey } from "@/lib/deck/card-image";
import { repoGetAllCards, repoGetMediaAsset } from "@/lib/db/content-actions";

import { DeckClient, type DeckCardItem } from "./deck-client";

export const metadata = { title: "Deck — Lang-Tutor" };
export const dynamic = "force-dynamic";

function toDeckCardItem(card: Card, hasApprovedImage: boolean): DeckCardItem {
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
    hasApprovedImage,
  };
}

async function loadDeckCards(): Promise<DeckCardItem[]> {
  const cards = await repoGetAllCards();
  const uniqueWords = [...new Set(cards.map((card) => card.word))];
  const imageWords = new Set<string>();

  await Promise.all(
    uniqueWords.map(async (word) => {
      const asset = await repoGetMediaAsset(deckWordImageKey(word));
      if (asset) imageWords.add(word.toLowerCase());
    }),
  );

  return cards.map((card) => toDeckCardItem(card, imageWords.has(card.word.toLowerCase())));
}

export default async function DeckPage() {
  const items = await loadDeckCards();

  return <DeckClient initialCards={items} />;
}

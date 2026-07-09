"use client";

import { useEffect, useState } from "react";

import { deckWordImageKey } from "@/lib/deck/card-image";
import { getContentRepository } from "@/lib/registry";

import type { DeckCardItem } from "./deck-client";

function initialImageWords(cards: DeckCardItem[]): Set<string> {
  const words = new Set<string>();
  for (const card of cards) {
    if (card.hasApprovedImage) {
      words.add(card.word.toLowerCase());
    }
  }
  return words;
}

/** Learner-facing approved-image availability per normalized deck word. */
export function useDeckCardImages(cards: DeckCardItem[]): (word: string) => boolean {
  const [imageWords, setImageWords] = useState(() => initialImageWords(cards));

  useEffect(() => {
    const uniqueWords = [...new Set(cards.map((card) => card.word))];
    let active = true;
    void (async () => {
      const repo = getContentRepository();
      const withImages = new Set<string>();
      if (uniqueWords.length > 0) {
        await Promise.all(
          uniqueWords.map(async (word) => {
            const asset = await repo.getMediaAsset(deckWordImageKey(word));
            if (asset) withImages.add(word.toLowerCase());
          }),
        );
      }
      if (active) setImageWords(withImages);
    })();

    return () => {
      active = false;
    };
  }, [cards]);

  return (word: string) => imageWords.has(word.toLowerCase());
}

import type { CollectionSummary, Unit } from "@/lib/db";

/** Negative ids avoid collision with persisted {@link Collection} rows. */
export function unitVocabCollectionId(unitId: number): number {
  return -unitId;
}

export function isDerivedUnitVocabCollection(
  collection: Pick<CollectionSummary, "id" | "kind">,
): boolean {
  return collection.kind === "unit" && collection.id < 0;
}

export interface UnitVocabDerivationCard {
  id: number;
  word: string;
}

export interface UnitVocabDerivationResult {
  collections: CollectionSummary[];
  membershipByCollection: Map<number, Set<number>>;
}

/**
 * Builds one read-only collection per completed learning-path unit whose
 * `targetVocab` is non-empty. Members are the learner's cards whose word
 * appears in that vocab list (case-insensitive).
 */
export function deriveUnitVocabCollections(
  units: ReadonlyArray<Pick<Unit, "id" | "index" | "title" | "targetVocab" | "status">>,
  cards: ReadonlyArray<UnitVocabDerivationCard>,
): UnitVocabDerivationResult {
  const cardsByWord = new Map<string, number[]>();
  for (const card of cards) {
    const key = card.word.toLowerCase();
    const bucket = cardsByWord.get(key);
    if (bucket) {
      bucket.push(card.id);
    } else {
      cardsByWord.set(key, [card.id]);
    }
  }

  const collections: CollectionSummary[] = [];
  const membershipByCollection = new Map<number, Set<number>>();

  const completedWithVocab = units
    .filter((unit) => unit.status === "completed" && unit.targetVocab.length > 0)
    .sort((a, b) => a.index - b.index);

  for (const unit of completedWithVocab) {
    const memberIds = new Set<number>();
    for (const word of unit.targetVocab) {
      const cardIds = cardsByWord.get(word.toLowerCase());
      if (!cardIds) continue;
      for (const cardId of cardIds) memberIds.add(cardId);
    }

    const collectionId = unitVocabCollectionId(unit.id);
    collections.push({
      id: collectionId,
      name: unit.title,
      kind: "unit",
      cardCount: memberIds.size,
    });
    membershipByCollection.set(collectionId, memberIds);
  }

  return { collections, membershipByCollection };
}

/** Builds collectionId → member card ids from per-collection card id lists. */
export function buildCollectionMembershipMap(
  entries: ReadonlyArray<{ collectionId: number; cardIds: ReadonlyArray<number> }>,
): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  for (const { collectionId, cardIds } of entries) {
    map.set(collectionId, new Set(cardIds));
  }
  return map;
}

/** Returns collection ids that include the given card. */
export function getCardCollectionIds(
  cardId: number,
  membershipByCollection: ReadonlyMap<number, ReadonlySet<number>>,
): number[] {
  const result: number[] = [];
  for (const [collectionId, cardIds] of membershipByCollection) {
    if (cardIds.has(cardId)) result.push(collectionId);
  }
  return result;
}

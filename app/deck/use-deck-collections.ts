"use client";

import { useCallback, useEffect, useState } from "react";

import { buildCollectionMembershipMap, deriveUnitVocabCollections } from "@/lib/deck";
import type { CollectionSummary } from "@/lib/db";
import { getContentRepository } from "@/lib/registry";

async function loadCollectionState(): Promise<{
  collections: CollectionSummary[];
  membershipByCollection: Map<number, Set<number>>;
}> {
  const repo = getContentRepository();
  const [userCollections, cards, units] = await Promise.all([
    repo.getCollections(),
    repo.getAllCards(),
    repo.getUnits(),
  ]);
  const entries = await Promise.all(
    userCollections.map(async (col) => ({
      collectionId: col.id,
      cardIds: (await repo.getCollectionCards(col.id)).map((card) => card.id),
    })),
  );
  const userMembership = buildCollectionMembershipMap(entries);
  const { collections: unitCollections, membershipByCollection: unitMembership } =
    deriveUnitVocabCollections(units, cards);

  const membershipByCollection = new Map(userMembership);
  for (const [collectionId, memberIds] of unitMembership) {
    membershipByCollection.set(collectionId, memberIds);
  }

  return {
    collections: [...userCollections, ...unitCollections],
    membershipByCollection,
  };
}

export function useDeckCollections() {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [membershipByCollection, setMembershipByCollection] = useState<Map<number, Set<number>>>(
    new Map(),
  );
  const [collectionFilter, setCollectionFilter] = useState<number | null>(null);

  const applyCollectionState = useCallback(
    (state: {
      collections: CollectionSummary[];
      membershipByCollection: Map<number, Set<number>>;
    }) => {
      setCollections(state.collections);
      setMembershipByCollection(state.membershipByCollection);
      setCollectionFilter((current) =>
        current !== null && state.collections.some((col) => col.id === current) ? current : null,
      );
    },
    [],
  );

  const refreshCollections = useCallback(async () => {
    applyCollectionState(await loadCollectionState());
  }, [applyCollectionState]);

  useEffect(() => {
    let active = true;
    void loadCollectionState().then((state) => {
      if (!active) return;
      applyCollectionState(state);
    });
    return () => {
      active = false;
    };
  }, [applyCollectionState]);

  const memberCardIdsForFilter =
    collectionFilter !== null ? (membershipByCollection.get(collectionFilter) ?? new Set()) : null;

  const createCollection = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      await getContentRepository().addCollection({ name: trimmed, kind: "user" });
      await refreshCollections();
      return true;
    },
    [refreshCollections],
  );

  const renameCollection = useCallback(
    async (id: number, name: string) => {
      if (id < 0) return false;
      const trimmed = name.trim();
      if (!trimmed) return false;
      await getContentRepository().renameCollection(id, trimmed);
      await refreshCollections();
      return true;
    },
    [refreshCollections],
  );

  const deleteCollection = useCallback(
    async (id: number) => {
      if (id < 0) return;
      await getContentRepository().deleteCollection(id);
      await refreshCollections();
    },
    [refreshCollections],
  );

  const setCardInCollection = useCallback(
    async (collectionId: number, cardId: number, member: boolean) => {
      if (collectionId < 0) return;
      const repo = getContentRepository();
      if (member) {
        await repo.addCardToCollection(collectionId, cardId);
      } else {
        await repo.removeCardFromCollection(collectionId, cardId);
      }
      await refreshCollections();
    },
    [refreshCollections],
  );

  return {
    collections,
    membershipByCollection,
    collectionFilter,
    setCollectionFilter,
    memberCardIdsForFilter,
    refreshCollections,
    createCollection,
    renameCollection,
    deleteCollection,
    setCardInCollection,
  };
}

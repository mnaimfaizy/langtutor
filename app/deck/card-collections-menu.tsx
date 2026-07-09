"use client";

import { useState } from "react";

import { getCardCollectionIds } from "@/lib/deck/collection-membership";
import type { CollectionSummary } from "@/lib/db";
import { Popover, PopoverContent, PopoverTrigger, SelectPill } from "@/ui";

export function CardCollectionsMenu({
  cardId,
  word,
  collections,
  membershipByCollection,
  onSetCardInCollection,
}: {
  cardId: number;
  word: string;
  collections: CollectionSummary[];
  membershipByCollection: ReadonlyMap<number, ReadonlySet<number>>;
  onSetCardInCollection: (collectionId: number, cardId: number, member: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busyCollectionId, setBusyCollectionId] = useState<number | null>(null);
  const memberCollectionIds = new Set(getCardCollectionIds(cardId, membershipByCollection));
  const editableCollections = collections.filter((collection) => collection.kind === "user");

  async function handleToggle(collectionId: number, member: boolean) {
    setBusyCollectionId(collectionId);
    try {
      await onSetCardInCollection(collectionId, cardId, member);
    } finally {
      setBusyCollectionId(null);
    }
  }

  if (editableCollections.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        variant="secondary"
        size="sm"
        data-testid={`deck-card-collections-${cardId}`}
        aria-label={`Manage collections for ${word}`}
      >
        Collections
        {memberCollectionIds.size > 0 && (
          <span className="text-muted ml-1 tabular-nums">({memberCollectionIds.size})</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3">
        <p className="text-foreground mb-2 text-sm font-medium">Add to collection</p>
        <div className="flex flex-col gap-2">
          {editableCollections.map((collection) => {
            const selected = memberCollectionIds.has(collection.id);
            return (
              <SelectPill
                key={collection.id}
                data-testid={`deck-collection-toggle-${collection.id}-${cardId}`}
                selected={selected}
                disabled={busyCollectionId === collection.id}
                onClick={() => void handleToggle(collection.id, !selected)}
                className="w-full justify-start rounded-lg px-3 py-1.5 text-left"
              >
                {collection.name}
              </SelectPill>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

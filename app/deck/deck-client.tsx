"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Cefr, ExperienceMode } from "@/lib/db";
import { DEFAULT_EXPERIENCE_MODE } from "@/lib/db";
import {
  applyDeckCardFilters,
  filterDeckCardsByCollection,
  hasDeckBrowserScopeActive,
  scopedReviewHref,
  sortDeckCards,
  type DeckCardFilters,
  type DeckDueStatusFilter,
  type DeckSortMode,
} from "@/lib/deck";
import type { MasteryLabel } from "@/lib/srs";
import { getContentRepository } from "@/lib/registry";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@/ui";

import { AddWordForm } from "./add-word-form";
import { DeckBrowserCard } from "./deck-browser-card";
import { DeckFiltersRail } from "./deck-filters-rail";
import { EditCardForm } from "./edit-card-form";
import { useDeckCollections } from "./use-deck-collections";
import { useDeckCardImages } from "./use-deck-card-images";

/** Serializable card row passed from the server component. */
export interface DeckCardItem {
  id: number;
  word: string;
  definition: string;
  examples: string[];
  cefr: Cefr;
  fsrsState: number;
  dueIso: string;
  createdAtIso: string;
  lastReviewIso?: string;
  suspended?: boolean;
  /** Server-hint: approved kid illustration exists for this word (refreshed client-side). */
  hasApprovedImage?: boolean;
}

function toDeckCardItem(card: {
  id: number;
  word: string;
  definition: string;
  examples: string[];
  cefr: Cefr;
  fsrs: { state: number; due: Date; lastReview?: Date };
  createdAt: Date;
  suspended?: boolean;
}): DeckCardItem {
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

export function DeckClient({ initialCards }: { initialCards: DeckCardItem[] }) {
  const [cards, setCards] = useState<DeckCardItem[]>(initialCards);
  const [addOpen, setAddOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<DeckCardItem | null>(null);
  const [cardToDelete, setCardToDelete] = useState<DeckCardItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cardToReset, setCardToReset] = useState<DeckCardItem | null>(null);
  const [resetting, setResetting] = useState(false);
  const [suspendingId, setSuspendingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cefrFilter, setCefrFilter] = useState<Cefr | null>(null);
  const [masteryFilter, setMasteryFilter] = useState<MasteryLabel | null>(null);
  const [dueFilter, setDueFilter] = useState<DeckDueStatusFilter | null>(null);
  const [sortMode, setSortMode] = useState<DeckSortMode>("due");
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>(DEFAULT_EXPERIENCE_MODE);
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [createCollectionName, setCreateCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);
  const now = useMemo(() => new Date(), []);
  const hasApprovedImage = useDeckCardImages(cards);
  const {
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
  } = useDeckCollections();

  useEffect(() => {
    let active = true;
    void getContentRepository()
      .getProfile()
      .then((profile) => {
        if (!active) return;
        setExperienceMode(profile?.experienceMode ?? DEFAULT_EXPERIENCE_MODE);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshCards = useCallback(async () => {
    const all = await getContentRepository().getAllCards();
    setCards(all.map(toDeckCardItem));
    await refreshCollections();
  }, [refreshCollections]);

  const handleCardAdded = useCallback(() => {
    void refreshCards();
    setAddOpen(false);
  }, [refreshCards]);

  const handleCardEdited = useCallback(() => {
    void refreshCards();
    setEditingCard(null);
  }, [refreshCards]);

  const handleDeleteConfirmed = useCallback(async () => {
    if (!cardToDelete) return;

    setDeleting(true);
    try {
      await getContentRepository().deleteCard(cardToDelete.id);
      setCardToDelete(null);
      await refreshCards();
    } catch {
      // keep dialog open so the learner can retry or cancel
    } finally {
      setDeleting(false);
    }
  }, [cardToDelete, refreshCards]);

  const handleResetConfirmed = useCallback(async () => {
    if (!cardToReset) return;

    setResetting(true);
    try {
      await getContentRepository().resetCardProgress(cardToReset.id);
      setCardToReset(null);
      await refreshCards();
    } catch {
      // keep dialog open so the learner can retry or cancel
    } finally {
      setResetting(false);
    }
  }, [cardToReset, refreshCards]);

  const handleSuspendToggle = useCallback(
    async (card: DeckCardItem) => {
      setSuspendingId(card.id);
      try {
        const repo = getContentRepository();
        if (card.suspended) {
          await repo.unsuspendCard(card.id);
        } else {
          await repo.suspendCard(card.id);
        }
        await refreshCards();
      } catch {
        // leave card state unchanged on failure
      } finally {
        setSuspendingId(null);
      }
    },
    [refreshCards],
  );

  const handleCreateCollection = useCallback(async () => {
    setCreatingCollection(true);
    try {
      const ok = await createCollection(createCollectionName);
      if (ok) {
        setCreateCollectionName("");
        setCreateCollectionOpen(false);
      }
    } finally {
      setCreatingCollection(false);
    }
  }, [createCollection, createCollectionName]);

  const filters = useMemo<DeckCardFilters>(
    () => ({ cefr: cefrFilter, mastery: masteryFilter, due: dueFilter }),
    [cefrFilter, masteryFilter, dueFilter],
  );

  const filteredCards = useMemo(() => {
    const afterFacets = applyDeckCardFilters(cards, filters, searchQuery, now);
    return filterDeckCardsByCollection(afterFacets, memberCardIdsForFilter);
  }, [cards, filters, searchQuery, now, memberCardIdsForFilter]);

  const displayCards = useMemo(
    () => sortDeckCards(filteredCards, sortMode),
    [filteredCards, sortMode],
  );

  const scopeActive = hasDeckBrowserScopeActive(filters, collectionFilter, searchQuery);
  const scopedReviewUrl = useMemo(
    () => scopedReviewHref(filteredCards.map((card) => card.id)),
    [filteredCards],
  );

  return (
    <main className="flex flex-1 flex-col px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
              Your deck
            </h1>
            <p className="text-muted mt-1 text-sm leading-6">
              Every word you own — with level, mastery state, and next review date.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/deck/stats"
              data-testid="link-deck-stats"
              className="text-accent text-sm font-medium underline underline-offset-4"
            >
              View stats
            </Link>

            <Dialog
              open={createCollectionOpen}
              onOpenChange={(open) => {
                setCreateCollectionOpen(open);
                if (!open) setCreateCollectionName("");
              }}
            >
              <DialogTrigger data-testid="deck-collection-create" size="md" variant="secondary">
                New collection
              </DialogTrigger>
              <DialogContent className="w-[min(90vw,24rem)]">
                <DialogTitle>Create collection</DialogTitle>
                <DialogDescription>
                  Group related words under a name like &ldquo;animals&rdquo; or
                  &ldquo;travel&rdquo;.
                </DialogDescription>
                <label className="sr-only" htmlFor="deck-header-collection-create-name">
                  Collection name
                </label>
                <Input
                  id="deck-header-collection-create-name"
                  data-testid="deck-collection-create-name"
                  value={createCollectionName}
                  onChange={(event) => setCreateCollectionName(event.target.value)}
                  placeholder="Collection name"
                  className="mt-4"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleCreateCollection();
                  }}
                />
                <div className="mt-5 flex justify-end gap-3">
                  <DialogClose disabled={creatingCollection}>Cancel</DialogClose>
                  <Button
                    data-testid="deck-collection-create-confirm"
                    onClick={() => void handleCreateCollection()}
                    disabled={creatingCollection || createCollectionName.trim().length === 0}
                  >
                    {creatingCollection ? "Creating…" : "Create"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger data-testid="btn-add-word" size="md">
                Add word
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Add a word</DialogTitle>
                <DialogDescription>
                  Look up a definition, then add the word to your spaced-repetition deck.
                </DialogDescription>
                <AddWordForm onCardAdded={handleCardAdded} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Dialog
          open={editingCard !== null}
          onOpenChange={(open) => {
            if (!open) setEditingCard(null);
          }}
        >
          <DialogContent>
            {editingCard && <EditCardForm card={editingCard} onSaved={handleCardEdited} />}
          </DialogContent>
        </Dialog>

        <Dialog
          open={cardToDelete !== null}
          onOpenChange={(open) => {
            if (!open && !deleting) setCardToDelete(null);
          }}
        >
          <DialogContent>
            <DialogTitle>Delete card?</DialogTitle>
            <DialogDescription>
              {cardToDelete
                ? `Remove “${cardToDelete.word}” from your deck? This cannot be undone.`
                : "Remove this card from your deck? This cannot be undone."}
            </DialogDescription>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose render={<Button variant="secondary" disabled={deleting} />}>
                Cancel
              </DialogClose>
              <Button
                data-testid="deck-card-delete-confirm"
                onClick={() => void handleDeleteConfirmed()}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={cardToReset !== null}
          onOpenChange={(open) => {
            if (!open && !resetting) setCardToReset(null);
          }}
        >
          <DialogContent>
            <DialogTitle>Reset progress?</DialogTitle>
            <DialogDescription>
              {cardToReset
                ? `Clear review history for “${cardToReset.word}” and treat it as new? The word stays in your deck.`
                : "Clear review history for this card and treat it as new? The word stays in your deck."}
            </DialogDescription>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose render={<Button variant="secondary" disabled={resetting} />}>
                Cancel
              </DialogClose>
              <Button
                data-testid="deck-card-reset-confirm"
                onClick={() => void handleResetConfirmed()}
                disabled={resetting}
              >
                {resetting ? "Resetting…" : "Reset"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="mt-10" data-testid="deck-browser" data-experience-mode={experienceMode}>
          {cards.length === 0 ? (
            <p className="text-muted text-sm" data-testid="deck-empty">
              No cards yet. Add a word to start building your deck.
            </p>
          ) : (
            <DeckFiltersRail
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              cefrFilter={cefrFilter}
              onCefrFilterChange={setCefrFilter}
              masteryFilter={masteryFilter}
              onMasteryFilterChange={setMasteryFilter}
              dueFilter={dueFilter}
              onDueFilterChange={setDueFilter}
              sortMode={sortMode}
              onSortModeChange={setSortMode}
              collections={collections}
              collectionFilter={collectionFilter}
              onCollectionFilterChange={setCollectionFilter}
              onRenameCollection={renameCollection}
              onDeleteCollection={deleteCollection}
              filteredCount={filteredCards.length}
              totalCount={cards.length}
              scopeActive={scopeActive}
              scopedReviewUrl={scopedReviewUrl}
            >
              {filteredCards.length === 0 ? (
                <p className="text-muted text-sm" data-testid="deck-search-empty">
                  No cards match your search or filters.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {displayCards.map((card) => (
                    <li key={card.id}>
                      <DeckBrowserCard
                        card={card}
                        experienceMode={experienceMode}
                        hasApprovedImage={hasApprovedImage(card.word)}
                        now={now}
                        collections={collections}
                        membershipByCollection={membershipByCollection}
                        onSetCardInCollection={setCardInCollection}
                        suspendingId={suspendingId}
                        onSuspendToggle={(item) => void handleSuspendToggle(item)}
                        onReset={setCardToReset}
                        onEdit={setEditingCard}
                        onDelete={setCardToDelete}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </DeckFiltersRail>
          )}
        </div>
      </div>
    </main>
  );
}

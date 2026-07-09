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
import { masteryLabelDisplay, type MasteryLabel } from "@/lib/srs";
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
  SelectPill,
} from "@/ui";

import { AddWordForm } from "./add-word-form";
import { DeckBrowserCard } from "./deck-browser-card";
import { CollectionsPanel } from "./collections-panel";
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

const CEFR_LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const MASTERY_FILTERS: MasteryLabel[] = ["new", "learning", "review", "relearning"];

const DUE_FILTERS: { value: DeckDueStatusFilter; label: string }[] = [
  { value: "due", label: "Due now" },
  { value: "later", label: "Due later" },
];

const SORT_OPTIONS: { value: DeckSortMode; label: string }[] = [
  { value: "due", label: "Due date" },
  { value: "recency", label: "Recency" },
  { value: "alphabet", label: "A–Z" },
];

function toggleFilter<T>(current: T | null, value: T): T | null {
  return current === value ? null : value;
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
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
              Your deck
            </h1>
            <p className="text-muted mt-1 text-sm leading-6">
              Every word you own — with level, mastery state, and next review date.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/deck/stats"
              data-testid="link-deck-stats"
              className="text-accent text-sm font-medium underline underline-offset-4"
            >
              View stats
            </Link>

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger data-testid="btn-open-add-word">Add a word</DialogTrigger>
              <DialogContent className="w-[min(90vw,32rem)]">
                <DialogTitle>Add a word</DialogTitle>
                <DialogDescription>
                  Look up a word in the lexicon and add it to your spaced-repetition deck.
                </DialogDescription>
                <AddWordForm className="mt-4" onCardAdded={handleCardAdded} />
              </DialogContent>
            </Dialog>

            <Dialog
              open={editingCard !== null}
              onOpenChange={(open) => {
                if (!open) setEditingCard(null);
              }}
            >
              <DialogContent className="w-[min(90vw,32rem)]">
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
                  <strong className="text-foreground">&ldquo;{cardToDelete?.word}&rdquo;</strong>{" "}
                  will be permanently removed from your deck, including its review history and
                  collection memberships. This cannot be undone.
                </DialogDescription>
                <div className="mt-5 flex justify-end gap-3">
                  <DialogClose disabled={deleting}>Cancel</DialogClose>
                  <Button
                    data-testid="deck-card-delete-confirm"
                    variant="secondary"
                    onClick={() => void handleDeleteConfirmed()}
                    disabled={deleting}
                    className="bg-danger/10 text-danger hover:bg-danger/20 border-danger/30"
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
                  <strong className="text-foreground">&ldquo;{cardToReset?.word}&rdquo;</strong>{" "}
                  will start over as a new card. Its review history and scheduling will be cleared,
                  but the word, definition, and examples stay the same.
                </DialogDescription>
                <div className="mt-5 flex justify-end gap-3">
                  <DialogClose disabled={resetting}>Cancel</DialogClose>
                  <Button
                    data-testid="deck-card-reset-confirm"
                    variant="secondary"
                    onClick={() => void handleResetConfirmed()}
                    disabled={resetting}
                    className="bg-danger/10 text-danger hover:bg-danger/20 border-danger/30"
                  >
                    {resetting ? "Resetting…" : "Reset progress"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mt-8" data-testid="deck-browser" data-experience-mode={experienceMode}>
          {cards.length === 0 ? (
            <p className="text-muted text-sm" data-testid="deck-empty">
              No words in your deck yet. Add your first word to get started.
            </p>
          ) : (
            <>
              <label className="sr-only" htmlFor="deck-search">
                Search deck
              </label>
              <Input
                id="deck-search"
                data-testid="deck-search-input"
                type="search"
                placeholder="Search by word or definition…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="mb-4 max-w-md"
                aria-label="Search deck by word or definition"
              />

              <CollectionsPanel
                collections={collections}
                collectionFilter={collectionFilter}
                onCollectionFilterChange={setCollectionFilter}
                onCreateCollection={createCollection}
                onRenameCollection={renameCollection}
                onDeleteCollection={deleteCollection}
              />

              <div className="mb-6 space-y-4">
                <div>
                  <p className="text-foreground mb-2 text-sm font-medium">CEFR level</p>
                  <div className="flex flex-wrap gap-2">
                    {CEFR_LEVELS.map((level) => (
                      <SelectPill
                        key={level}
                        data-testid={`deck-filter-cefr-${level}`}
                        selected={cefrFilter === level}
                        onClick={() => setCefrFilter((current) => toggleFilter(current, level))}
                        className="rounded-lg px-3 py-1.5"
                      >
                        {level}
                      </SelectPill>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-foreground mb-2 text-sm font-medium">Mastery state</p>
                  <div className="flex flex-wrap gap-2">
                    {MASTERY_FILTERS.map((mastery) => (
                      <SelectPill
                        key={mastery}
                        data-testid={`deck-filter-mastery-${mastery}`}
                        selected={masteryFilter === mastery}
                        onClick={() =>
                          setMasteryFilter((current) => toggleFilter(current, mastery))
                        }
                        className="rounded-lg px-3 py-1.5"
                      >
                        {masteryLabelDisplay(mastery)}
                      </SelectPill>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-foreground mb-2 text-sm font-medium">Due status</p>
                  <div className="flex flex-wrap gap-2">
                    {DUE_FILTERS.map(({ value, label }) => (
                      <SelectPill
                        key={value}
                        data-testid={`deck-filter-due-${value}`}
                        selected={dueFilter === value}
                        onClick={() => setDueFilter((current) => toggleFilter(current, value))}
                        className="rounded-lg px-3 py-1.5"
                      >
                        {label}
                      </SelectPill>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-foreground mb-2 text-sm font-medium">Sort by</p>
                  <div className="flex flex-wrap gap-2">
                    {SORT_OPTIONS.map(({ value, label }) => (
                      <SelectPill
                        key={value}
                        data-testid={`deck-sort-${value}`}
                        selected={sortMode === value}
                        onClick={() => setSortMode(value)}
                        className="rounded-lg px-3 py-1.5"
                      >
                        {label}
                      </SelectPill>
                    ))}
                  </div>
                </div>
              </div>

              {scopeActive && (
                <div className="mb-6">
                  <Link href={scopedReviewUrl}>
                    <Button data-testid="btn-review-these" variant="gradient">
                      Review these
                    </Button>
                  </Link>
                </div>
              )}

              {filteredCards.length === 0 ? (
                <p className="text-muted text-sm" data-testid="deck-search-empty">
                  No cards match your search or filters.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            </>
          )}
        </div>
      </div>
    </main>
  );
}

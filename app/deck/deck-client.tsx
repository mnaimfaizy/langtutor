"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import type { Cefr } from "@/lib/db";
import { CEFR_BADGE_VARIANT } from "@/lib/cefr";
import { applyDeckCardFilters, type DeckCardFilters, type DeckDueStatusFilter } from "@/lib/deck";
import {
  formatNextDue,
  masteryLabelDisplay,
  masteryLabelFromState,
  type MasteryLabel,
} from "@/lib/srs";
import { getContentRepository } from "@/lib/registry";
import {
  Badge,
  Card,
  CardDescription,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Input,
  SelectPill,
  type BadgeVariant,
  cn,
} from "@/ui";

import { AddWordForm } from "./add-word-form";

/** Serializable card row passed from the server component. */
export interface DeckCardItem {
  id: number;
  word: string;
  definition: string;
  cefr: Cefr;
  fsrsState: number;
  dueIso: string;
  suspended?: boolean;
}

const MASTERY_BADGE_VARIANT: Record<MasteryLabel, BadgeVariant> = {
  new: "neutral",
  learning: "accent",
  review: "success",
  relearning: "warning",
};

const CEFR_LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const MASTERY_FILTERS: MasteryLabel[] = ["new", "learning", "review", "relearning"];

const DUE_FILTERS: { value: DeckDueStatusFilter; label: string }[] = [
  { value: "due", label: "Due now" },
  { value: "later", label: "Due later" },
];

function toggleFilter<T>(current: T | null, value: T): T | null {
  return current === value ? null : value;
}

function definitionSnippet(definition: string, maxLen = 120): string {
  if (definition.length <= maxLen) return definition;
  return `${definition.slice(0, maxLen).trimEnd()}…`;
}

function toDeckCardItem(card: {
  id: number;
  word: string;
  definition: string;
  cefr: Cefr;
  fsrs: { state: number; due: Date };
  suspended?: boolean;
}): DeckCardItem {
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

export function DeckClient({ initialCards }: { initialCards: DeckCardItem[] }) {
  const [cards, setCards] = useState<DeckCardItem[]>(initialCards);
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cefrFilter, setCefrFilter] = useState<Cefr | null>(null);
  const [masteryFilter, setMasteryFilter] = useState<MasteryLabel | null>(null);
  const [dueFilter, setDueFilter] = useState<DeckDueStatusFilter | null>(null);
  const now = useMemo(() => new Date(), []);

  const refreshCards = useCallback(async () => {
    const all = await getContentRepository().getAllCards();
    setCards(
      all
        .map(toDeckCardItem)
        .sort((a, b) => a.word.localeCompare(b.word, undefined, { sensitivity: "base" })),
    );
  }, []);

  const handleCardAdded = useCallback(() => {
    void refreshCards();
    setAddOpen(false);
  }, [refreshCards]);

  const sortedCards = useMemo(
    () =>
      [...cards].sort((a, b) => a.word.localeCompare(b.word, undefined, { sensitivity: "base" })),
    [cards],
  );

  const filters = useMemo<DeckCardFilters>(
    () => ({ cefr: cefrFilter, mastery: masteryFilter, due: dueFilter }),
    [cefrFilter, masteryFilter, dueFilter],
  );

  const filteredCards = useMemo(
    () => applyDeckCardFilters(sortedCards, filters, searchQuery, now),
    [sortedCards, filters, searchQuery, now],
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
          </div>
        </div>

        <div className="mt-8" data-testid="deck-browser">
          {sortedCards.length === 0 ? (
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
              </div>

              {filteredCards.length === 0 ? (
                <p className="text-muted text-sm" data-testid="deck-search-empty">
                  No cards match your search or filters.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCards.map((card) => {
                    const mastery = masteryLabelFromState(card.fsrsState);
                    const due = new Date(card.dueIso);
                    return (
                      <li key={card.id}>
                        <Card
                          data-testid={`deck-card-${card.id}`}
                          className={cn(card.suspended && "opacity-60")}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base">{card.word}</CardTitle>
                            <Badge variant={CEFR_BADGE_VARIANT[card.cefr]} size="sm">
                              {card.cefr}
                            </Badge>
                          </div>
                          <CardDescription>{definitionSnippet(card.definition)}</CardDescription>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant={MASTERY_BADGE_VARIANT[mastery]} size="sm">
                              {masteryLabelDisplay(mastery)}
                            </Badge>
                            {card.suspended && (
                              <Badge variant="neutral" size="sm">
                                Suspended
                              </Badge>
                            )}
                            <span className="text-muted text-xs tabular-nums">
                              {formatNextDue(due, now)}
                            </span>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

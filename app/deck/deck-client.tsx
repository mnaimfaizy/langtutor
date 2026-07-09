"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import type { Cefr } from "@/lib/db";
import { CEFR_BADGE_VARIANT } from "@/lib/cefr";
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
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedCards.map((card) => {
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
        </div>
      </div>
    </main>
  );
}

"use client";

import type { CollectionSummary, ExperienceMode } from "@/lib/db";
import { CEFR_BADGE_VARIANT } from "@/lib/cefr";
import { deckWordImageUrl, resolveDeckCardLayout } from "@/lib/deck/card-image";
import {
  formatNextDue,
  masteryLabelDisplay,
  masteryLabelFromState,
  type MasteryLabel,
} from "@/lib/srs";
import { Badge, Button, ProgressRing, TtsButton, type BadgeVariant, cn } from "@/ui";

import { CardCollectionsMenu } from "./card-collections-menu";
import type { DeckCardItem } from "./deck-client";

const MASTERY_BADGE_VARIANT: Record<MasteryLabel, BadgeVariant> = {
  new: "neutral",
  learning: "accent",
  review: "success",
  relearning: "warning",
};

/** Discrete ring fill from FSRS phase — not real retrievability. */
const MASTERY_RING_PCT: Record<MasteryLabel, number> = {
  new: 8,
  learning: 42,
  relearning: 28,
  review: 82,
};

function definitionSnippet(definition: string, maxLen = 120): string {
  if (definition.length <= maxLen) return definition;
  return `${definition.slice(0, maxLen).trimEnd()}…`;
}

function DeckCardWordImage({
  word,
  layout,
}: {
  word: string;
  layout: "picture-first" | "accent";
}) {
  const pictureFirst = layout === "picture-first";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- same-origin media resolve URL
    <img
      data-testid={`deck-card-image-${layout}`}
      src={deckWordImageUrl(word)}
      alt=""
      width={pictureFirst ? 112 : 80}
      height={pictureFirst ? 112 : 80}
      className={cn("size-full object-contain p-1", pictureFirst && "p-0.5")}
    />
  );
}

export function DeckBrowserCard({
  card,
  experienceMode,
  hasApprovedImage,
  now,
  collections,
  membershipByCollection,
  onSetCardInCollection,
  suspendingId,
  onSuspendToggle,
  onReset,
  onEdit,
  onDelete,
}: {
  card: DeckCardItem;
  experienceMode: ExperienceMode;
  hasApprovedImage: boolean;
  now: Date;
  collections: CollectionSummary[];
  membershipByCollection: Map<number, Set<number>>;
  onSetCardInCollection: (collectionId: number, cardId: number, member: boolean) => Promise<void>;
  suspendingId: number | null;
  onSuspendToggle: (card: DeckCardItem) => void;
  onReset: (card: DeckCardItem) => void;
  onEdit: (card: DeckCardItem) => void;
  onDelete: (card: DeckCardItem) => void;
}) {
  const mastery = masteryLabelFromState(card.fsrsState);
  const due = new Date(card.dueIso);
  const layout = resolveDeckCardLayout(experienceMode, hasApprovedImage);
  const ringPct = MASTERY_RING_PCT[mastery];
  const mediaSize = layout === "picture-first" ? "size-28" : "size-20";

  return (
    <article
      data-testid={`deck-card-${card.id}`}
      data-deck-card-layout={layout}
      className={cn(
        "border-border bg-card overflow-hidden rounded-2xl border shadow-sm",
        card.suspended && "opacity-60",
      )}
    >
      <div className="from-accent/10 via-transparent to-warning/10 flex gap-4 bg-gradient-to-br p-4">
        <div
          className={cn(
            "bg-background/60 flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10",
            mediaSize,
          )}
        >
          {layout === "picture-first" || layout === "accent" ? (
            <DeckCardWordImage word={card.word} layout={layout} />
          ) : (
            <ProgressRing
              value={ringPct}
              size="md"
              aria-label={`${masteryLabelDisplay(mastery)} progress`}
            >
              <span className="text-foreground text-[10px] font-semibold tracking-wide uppercase">
                {masteryLabelDisplay(mastery).slice(0, 3)}
              </span>
            </ProgressRing>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-foreground text-xl font-semibold tracking-tight">{card.word}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant={CEFR_BADGE_VARIANT[card.cefr]} size="sm">
                  {card.cefr}
                </Badge>
                <Badge variant={MASTERY_BADGE_VARIANT[mastery]} size="sm">
                  {masteryLabelDisplay(mastery)}
                </Badge>
                {card.suspended && (
                  <Badge variant="neutral" size="sm">
                    Suspended
                  </Badge>
                )}
              </div>
            </div>
            <TtsButton text={card.word} className="shrink-0" />
          </div>
          <p className="text-muted text-sm leading-6">{definitionSnippet(card.definition, 100)}</p>
          <p className="text-foreground text-xs tabular-nums">{formatNextDue(due, now)}</p>
        </div>
      </div>

      <div className="border-border bg-background/40 flex flex-wrap items-center gap-x-1 gap-y-1 border-t px-2 py-1.5 sm:px-3">
        <CardCollectionsMenu
          cardId={card.id}
          word={card.word}
          collections={collections}
          membershipByCollection={membershipByCollection}
          onSetCardInCollection={onSetCardInCollection}
        />
        <Button
          variant="ghost"
          size="sm"
          data-testid={`deck-card-suspend-${card.id}`}
          onClick={() => void onSuspendToggle(card)}
          disabled={suspendingId === card.id}
          aria-label={card.suspended ? `Unsuspend ${card.word}` : `Suspend ${card.word}`}
        >
          {suspendingId === card.id ? "…" : card.suspended ? "Unsuspend" : "Suspend"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid={`deck-card-reset-${card.id}`}
          onClick={() => onReset(card)}
          aria-label={`Reset progress for ${card.word}`}
        >
          Reset
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid={`deck-card-edit-${card.id}`}
          onClick={() => onEdit(card)}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-danger hover:text-danger ml-auto"
          data-testid={`deck-card-delete-${card.id}`}
          onClick={() => onDelete(card)}
          aria-label={`Delete ${card.word}`}
        >
          Delete
        </Button>
      </div>
    </article>
  );
}

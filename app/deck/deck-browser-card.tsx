"use client";

import type { ExperienceMode } from "@/lib/db";
import { CEFR_BADGE_VARIANT } from "@/lib/cefr";
import { deckWordImageUrl, resolveDeckCardLayout } from "@/lib/deck/card-image";
import type { CollectionSummary } from "@/lib/db";
import {
  formatNextDue,
  masteryLabelDisplay,
  masteryLabelFromState,
  type MasteryLabel,
} from "@/lib/srs";
import { Badge, Button, Card, CardDescription, CardTitle, type BadgeVariant, cn } from "@/ui";

import { CardCollectionsMenu } from "./card-collections-menu";
import type { DeckCardItem } from "./deck-client";

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

function DeckCardWordImage({
  word,
  layout,
  className,
}: {
  word: string;
  layout: "picture-first" | "accent";
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- same-origin media resolve URL
    <img
      data-testid={`deck-card-image-${layout}`}
      src={deckWordImageUrl(word)}
      alt=""
      width={layout === "picture-first" ? 160 : 48}
      height={layout === "picture-first" ? 160 : 48}
      className={cn(
        "object-contain",
        layout === "picture-first" ? "mx-auto size-32 sm:size-36" : "size-10 shrink-0 sm:size-12",
        className,
      )}
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

  return (
    <Card
      data-testid={`deck-card-${card.id}`}
      data-deck-card-layout={layout}
      className={cn(card.suspended && "opacity-60")}
    >
      {layout === "picture-first" && (
        <div className="mb-3 flex justify-center">
          <DeckCardWordImage word={card.word} layout="picture-first" />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          {layout === "accent" ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <DeckCardWordImage word={card.word} layout="accent" />
              <CardTitle className="text-base">{card.word}</CardTitle>
            </div>
          ) : (
            <CardTitle className="text-base">{card.word}</CardTitle>
          )}
          <Badge variant={CEFR_BADGE_VARIANT[card.cefr]} size="sm" className="shrink-0">
            {card.cefr}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CardCollectionsMenu
            cardId={card.id}
            word={card.word}
            collections={collections}
            membershipByCollection={membershipByCollection}
            onSetCardInCollection={onSetCardInCollection}
          />
          <Button
            variant="secondary"
            size="sm"
            data-testid={`deck-card-suspend-${card.id}`}
            onClick={() => void onSuspendToggle(card)}
            disabled={suspendingId === card.id}
            aria-label={card.suspended ? `Unsuspend ${card.word}` : `Suspend ${card.word}`}
          >
            {suspendingId === card.id ? "…" : card.suspended ? "Unsuspend" : "Suspend"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            data-testid={`deck-card-reset-${card.id}`}
            onClick={() => onReset(card)}
            aria-label={`Reset progress for ${card.word}`}
          >
            Reset
          </Button>
          <Button
            variant="secondary"
            size="sm"
            data-testid={`deck-card-edit-${card.id}`}
            onClick={() => onEdit(card)}
          >
            Edit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            data-testid={`deck-card-delete-${card.id}`}
            onClick={() => onDelete(card)}
            aria-label={`Delete ${card.word}`}
          >
            Delete
          </Button>
        </div>
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
        <span className="text-muted text-xs tabular-nums">{formatNextDue(due, now)}</span>
      </div>
    </Card>
  );
}

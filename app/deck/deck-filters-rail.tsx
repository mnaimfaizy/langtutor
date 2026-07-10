"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useId, useState } from "react";

import type { Cefr, CollectionSummary } from "@/lib/db";
import { isDerivedUnitVocabCollection } from "@/lib/deck";
import type { DeckDueStatusFilter, DeckSortMode } from "@/lib/deck";
import { masteryLabelDisplay, type MasteryLabel } from "@/lib/srs";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  SelectPill,
} from "@/ui";

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

export interface DeckFiltersRailProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  cefrFilter: Cefr | null;
  onCefrFilterChange: (value: Cefr | null) => void;
  masteryFilter: MasteryLabel | null;
  onMasteryFilterChange: (value: MasteryLabel | null) => void;
  dueFilter: DeckDueStatusFilter | null;
  onDueFilterChange: (value: DeckDueStatusFilter | null) => void;
  sortMode: DeckSortMode;
  onSortModeChange: (value: DeckSortMode) => void;
  collections: CollectionSummary[];
  collectionFilter: number | null;
  onCollectionFilterChange: (collectionId: number | null) => void;
  onRenameCollection: (id: number, name: string) => Promise<boolean>;
  onDeleteCollection: (id: number) => Promise<void>;
  filteredCount: number;
  totalCount: number;
  scopeActive: boolean;
  scopedReviewUrl: string;
  children: ReactNode;
}

/**
 * Sticky filter rail (md+) / expandable Filters panel (&lt;md).
 * Create collection lives in the page header beside Add word.
 */
export function DeckFiltersRail({
  searchQuery,
  onSearchQueryChange,
  cefrFilter,
  onCefrFilterChange,
  masteryFilter,
  onMasteryFilterChange,
  dueFilter,
  onDueFilterChange,
  sortMode,
  onSortModeChange,
  collections,
  collectionFilter,
  onCollectionFilterChange,
  onRenameCollection,
  onDeleteCollection,
  filteredCount,
  totalCount,
  scopeActive,
  scopedReviewUrl,
  children,
}: DeckFiltersRailProps) {
  const searchId = useId();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeFacetCount =
    (cefrFilter ? 1 : 0) +
    (masteryFilter ? 1 : 0) +
    (dueFilter ? 1 : 0) +
    (collectionFilter !== null ? 1 : 0);

  const facetProps = {
    cefrFilter,
    onCefrFilterChange,
    masteryFilter,
    onMasteryFilterChange,
    dueFilter,
    onDueFilterChange,
    sortMode,
    onSortModeChange,
    collections,
    collectionFilter,
    onCollectionFilterChange,
    onRenameCollection,
    onDeleteCollection,
  };

  return (
    <div
      data-testid="deck-collections-panel"
      className="md:grid md:grid-cols-[13.5rem_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8"
    >
      <div className="mb-3 md:col-start-2 md:row-start-1 md:mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor={searchId} className="sr-only">
            Search deck
          </label>
          <Input
            id={searchId}
            data-testid="deck-search-input"
            type="search"
            placeholder="Search by word or definition…"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full sm:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted text-xs tabular-nums sm:order-last">
              {filteredCount} / {totalCount}
            </p>
            {scopeActive && (
              <Link href={scopedReviewUrl}>
                <Button data-testid="btn-review-these" variant="gradient" size="sm">
                  Review these
                </Button>
              </Link>
            )}
            <Button
              type="button"
              size="sm"
              variant={activeFacetCount > 0 ? "primary" : "secondary"}
              className="md:hidden"
              aria-expanded={mobileFiltersOpen}
              onClick={() => setMobileFiltersOpen((open) => !open)}
            >
              Filters{activeFacetCount > 0 ? ` · ${activeFacetCount}` : ""}
            </Button>
          </div>
        </div>
      </div>

      <aside
        className={`border-border bg-card/40 mb-4 rounded-2xl border p-4 md:sticky md:top-4 md:col-start-1 md:row-span-2 md:row-start-1 md:mb-0 md:self-start ${
          mobileFiltersOpen ? "block" : "hidden md:block"
        }`}
      >
        <p className="text-muted mb-3 hidden text-[11px] font-semibold tracking-[0.14em] uppercase md:block">
          Browse
        </p>
        <FilterFacets {...facetProps} />
        <p className="text-muted mt-4 hidden text-xs tabular-nums md:block">
          Showing {filteredCount} / {totalCount}
        </p>
      </aside>

      <div className="md:col-start-2 md:row-start-2">{children}</div>
    </div>
  );
}

type FacetProps = Pick<
  DeckFiltersRailProps,
  | "cefrFilter"
  | "onCefrFilterChange"
  | "masteryFilter"
  | "onMasteryFilterChange"
  | "dueFilter"
  | "onDueFilterChange"
  | "sortMode"
  | "onSortModeChange"
  | "collections"
  | "collectionFilter"
  | "onCollectionFilterChange"
  | "onRenameCollection"
  | "onDeleteCollection"
>;

function FilterFacets({
  cefrFilter,
  onCefrFilterChange,
  masteryFilter,
  onMasteryFilterChange,
  dueFilter,
  onDueFilterChange,
  sortMode,
  onSortModeChange,
  collections,
  collectionFilter,
  onCollectionFilterChange,
  onRenameCollection,
  onDeleteCollection,
}: FacetProps) {
  const [renaming, setRenaming] = useState<CollectionSummary | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [deleting, setDeleting] = useState<CollectionSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const userCollections = collections.filter((collection) => collection.kind === "user");

  async function handleRename() {
    if (!renaming) return;
    setRenameSaving(true);
    try {
      const ok = await onRenameCollection(renaming.id, renameName);
      if (ok) setRenaming(null);
    } finally {
      setRenameSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await onDeleteCollection(deleting.id);
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <RailSection title="Collection">
        <RailPill
          selected={collectionFilter === null}
          onClick={() => onCollectionFilterChange(null)}
          testId="deck-collection-filter-all"
        >
          All cards
        </RailPill>
        {collections.map((collection) => (
          <RailPill
            key={collection.id}
            selected={collectionFilter === collection.id}
            onClick={() => onCollectionFilterChange(collection.id)}
            testId={`deck-collection-filter-${collection.id}`}
          >
            <span className="truncate">{collection.name}</span>
            {isDerivedUnitVocabCollection(collection) && (
              <span className="text-muted text-[10px]">(unit vocab)</span>
            )}
            <span className="text-muted ml-auto tabular-nums">{collection.cardCount}</span>
          </RailPill>
        ))}
      </RailSection>

      {userCollections.length > 0 && (
        <RailSection title="Manage">
          <ul className="space-y-1.5">
            {userCollections.map((collection) => (
              <li
                key={collection.id}
                className="border-border flex flex-wrap items-center justify-between gap-1 rounded-lg border px-2 py-1.5"
                data-testid={`deck-collection-row-${collection.id}`}
              >
                <span className="text-foreground truncate text-xs">{collection.name}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    data-testid={`deck-collection-rename-${collection.id}`}
                    onClick={() => {
                      setRenaming(collection);
                      setRenameName(collection.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    data-testid={`deck-collection-delete-${collection.id}`}
                    onClick={() => setDeleting(collection)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </RailSection>
      )}

      <RailSection title="CEFR">
        <div className="flex flex-wrap gap-1.5">
          {CEFR_LEVELS.map((level) => (
            <SelectPill
              key={level}
              data-testid={`deck-filter-cefr-${level}`}
              selected={cefrFilter === level}
              onClick={() => onCefrFilterChange(toggleFilter(cefrFilter, level))}
              className="rounded-lg px-2.5 py-1 text-xs"
            >
              {level}
            </SelectPill>
          ))}
        </div>
      </RailSection>

      <RailSection title="Mastery">
        {MASTERY_FILTERS.map((label) => (
          <RailPill
            key={label}
            selected={masteryFilter === label}
            onClick={() => onMasteryFilterChange(toggleFilter(masteryFilter, label))}
            testId={`deck-filter-mastery-${label}`}
          >
            {masteryLabelDisplay(label)}
          </RailPill>
        ))}
      </RailSection>

      <RailSection title="Due">
        {DUE_FILTERS.map(({ value, label }) => (
          <RailPill
            key={value}
            selected={dueFilter === value}
            onClick={() => onDueFilterChange(toggleFilter(dueFilter, value))}
            testId={`deck-filter-due-${value}`}
          >
            {label}
          </RailPill>
        ))}
      </RailSection>

      <RailSection title="Sort">
        {SORT_OPTIONS.map(({ value, label }) => (
          <RailPill
            key={value}
            selected={sortMode === value}
            onClick={() => onSortModeChange(value)}
            testId={`deck-sort-${value}`}
          >
            {label}
          </RailPill>
        ))}
      </RailSection>

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open && !renameSaving) setRenaming(null);
        }}
      >
        <DialogContent className="w-[min(90vw,24rem)]">
          <DialogTitle>Rename collection</DialogTitle>
          <DialogDescription>Choose a new name for this collection.</DialogDescription>
          <label className="sr-only" htmlFor="deck-collection-rename-name">
            Collection name
          </label>
          <Input
            id="deck-collection-rename-name"
            data-testid="deck-collection-rename-name"
            value={renameName}
            onChange={(event) => setRenameName(event.target.value)}
            className="mt-4"
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleRename();
            }}
          />
          <div className="mt-5 flex justify-end gap-3">
            <DialogClose disabled={renameSaving}>Cancel</DialogClose>
            <Button
              data-testid="deck-collection-rename-confirm"
              onClick={() => void handleRename()}
              disabled={renameSaving || renameName.trim().length === 0}
            >
              {renameSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Delete collection?</DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">&ldquo;{deleting?.name}&rdquo;</strong> will be
            removed. Cards in this collection stay in your deck — only the grouping is deleted.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-3">
            <DialogClose disabled={deleteBusy}>Cancel</DialogClose>
            <Button
              data-testid="deck-collection-delete-confirm"
              variant="secondary"
              onClick={() => void handleDelete()}
              disabled={deleteBusy}
              className="bg-danger/10 text-danger hover:bg-danger/20 border-danger/30"
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-foreground mb-1.5 text-xs font-semibold">{title}</p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function RailPill({
  selected,
  onClick,
  children,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      onClick={onClick}
      className={
        selected
          ? "border-accent bg-accent/15 text-foreground flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium"
          : "text-muted hover:bg-foreground/5 hover:text-foreground flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-left text-xs"
      }
    >
      {children}
    </button>
  );
}

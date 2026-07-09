"use client";

import { useState } from "react";

import { isDerivedUnitVocabCollection } from "@/lib/deck";
import type { CollectionSummary } from "@/lib/db";
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

export function CollectionsPanel({
  collections,
  collectionFilter,
  onCollectionFilterChange,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
}: {
  collections: CollectionSummary[];
  collectionFilter: number | null;
  onCollectionFilterChange: (collectionId: number | null) => void;
  onCreateCollection: (name: string) => Promise<boolean>;
  onRenameCollection: (id: number, name: string) => Promise<boolean>;
  onDeleteCollection: (id: number) => Promise<void>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<CollectionSummary | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [deleting, setDeleting] = useState<CollectionSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const ok = await onCreateCollection(createName);
      if (ok) {
        setCreateName("");
        setCreateOpen(false);
      }
    } finally {
      setCreating(false);
    }
  }

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

  const userCollections = collections.filter((collection) => collection.kind === "user");

  return (
    <div className="mb-6 space-y-4" data-testid="deck-collections-panel">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-foreground text-sm font-medium">Collection</p>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger data-testid="deck-collection-create" size="sm" variant="secondary">
              New collection
            </DialogTrigger>
            <DialogContent className="w-[min(90vw,24rem)]">
              <DialogTitle>Create collection</DialogTitle>
              <DialogDescription>
                Group related words under a name like &ldquo;animals&rdquo; or &ldquo;travel&rdquo;.
              </DialogDescription>
              <label className="sr-only" htmlFor="deck-collection-create-name">
                Collection name
              </label>
              <Input
                id="deck-collection-create-name"
                data-testid="deck-collection-create-name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="Collection name"
                className="mt-4"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleCreate();
                }}
              />
              <div className="mt-5 flex justify-end gap-3">
                <DialogClose disabled={creating}>Cancel</DialogClose>
                <Button
                  data-testid="deck-collection-create-confirm"
                  onClick={() => void handleCreate()}
                  disabled={creating || createName.trim().length === 0}
                >
                  {creating ? "Creating…" : "Create"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex flex-wrap gap-2">
          <SelectPill
            data-testid="deck-collection-filter-all"
            selected={collectionFilter === null}
            onClick={() => onCollectionFilterChange(null)}
            className="rounded-lg px-3 py-1.5"
          >
            All cards
          </SelectPill>
          {collections.map((collection) => (
            <SelectPill
              key={collection.id}
              data-testid={`deck-collection-filter-${collection.id}`}
              selected={collectionFilter === collection.id}
              onClick={() => onCollectionFilterChange(collection.id)}
              className="rounded-lg px-3 py-1.5"
            >
              {collection.name}
              {isDerivedUnitVocabCollection(collection) && (
                <span className="text-muted ml-1 text-xs">(unit vocab)</span>
              )}
              <span className="text-muted ml-1 tabular-nums">({collection.cardCount})</span>
            </SelectPill>
          ))}
        </div>
      </div>

      {userCollections.length > 0 && (
        <div>
          <p className="text-foreground mb-2 text-sm font-medium">Manage collections</p>
          <ul className="space-y-2">
            {userCollections.map((collection) => (
              <li
                key={collection.id}
                className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                data-testid={`deck-collection-row-${collection.id}`}
              >
                <span className="text-foreground text-sm">
                  {collection.name}
                  <span className="text-muted ml-2 tabular-nums">
                    {collection.cardCount} card{collection.cardCount === 1 ? "" : "s"}
                  </span>
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    data-testid={`deck-collection-rename-${collection.id}`}
                    onClick={() => {
                      setRenaming(collection);
                      setRenameName(collection.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    data-testid={`deck-collection-delete-${collection.id}`}
                    onClick={() => setDeleting(collection)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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
    </div>
  );
}

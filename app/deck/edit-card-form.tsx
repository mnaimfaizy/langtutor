"use client";

import { useState } from "react";

import {
  formatExamplesText,
  parseExamplesText,
  validateCardDefinition,
} from "@/lib/deck/edit-card";
import { getContentRepository } from "@/lib/registry";
import { Button, cn, DialogClose, DialogDescription, DialogTitle } from "@/ui";

export interface EditableDeckCard {
  id: number;
  word: string;
  definition: string;
  examples: string[];
}

export function EditCardForm({
  card,
  className,
  onSaved,
}: {
  card: EditableDeckCard;
  className?: string;
  onSaved?: () => void;
}) {
  const [definition, setDefinition] = useState(card.definition);
  const [examplesText, setExamplesText] = useState(formatExamplesText(card.examples));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const validation = validateCardDefinition(definition);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await getContentRepository().updateCard(card.id, {
        definition: validation.definition,
        examples: parseExamplesText(examplesText),
      });
      onSaved?.();
    } catch {
      setError("Could not save changes. Please try again.");
      setSaving(false);
    }
  }

  const textareaClassName =
    "border-border bg-card text-foreground placeholder:text-muted focus-visible:border-accent focus-visible:ring-accent focus-visible:ring-offset-background w-full resize-y rounded-lg border px-3 py-2 text-sm leading-6 transition-[colors,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60";

  return (
    <div data-testid="edit-card-form" className={cn("w-full", className)}>
      <DialogTitle>Edit card</DialogTitle>
      <DialogDescription>
        Update the definition and examples for &ldquo;{card.word}&rdquo;. Scheduling state is
        unchanged.
      </DialogDescription>

      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor={`edit-definition-${card.id}`}
            className="text-foreground text-sm font-medium"
          >
            Definition
          </label>
          <textarea
            id={`edit-definition-${card.id}`}
            data-testid="edit-card-definition"
            rows={3}
            value={definition}
            onChange={(event) => {
              setDefinition(event.target.value);
              if (error) setError(null);
            }}
            disabled={saving}
            className={cn(textareaClassName, "mt-2")}
          />
        </div>

        <div>
          <label
            htmlFor={`edit-examples-${card.id}`}
            className="text-foreground text-sm font-medium"
          >
            Examples
          </label>
          <p className="text-muted mt-1 text-xs">One example per line.</p>
          <textarea
            id={`edit-examples-${card.id}`}
            data-testid="edit-card-examples"
            rows={4}
            value={examplesText}
            onChange={(event) => setExamplesText(event.target.value)}
            disabled={saving}
            placeholder="An example sentence…"
            className={cn(textareaClassName, "mt-2")}
          />
        </div>

        {error && (
          <p data-testid="edit-card-error" className="text-danger text-sm">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <DialogClose disabled={saving}>Cancel</DialogClose>
          <Button data-testid="edit-card-save" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

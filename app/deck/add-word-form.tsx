"use client";

import { useRef, useState } from "react";

import type { Cefr } from "@/lib/db";
import { buildNewCard, isDuplicate } from "@/lib/deck";
import { getContentRepository } from "@/lib/registry";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";

type LookupStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; word: string; definition: string; examples: string[]; cefr: Cefr | null }
  | { kind: "not-found"; word: string }
  | { kind: "error"; message: string };

type AddStatus = "idle" | "adding" | "added" | "duplicate";

const CEFR_LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function AddWordForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<LookupStatus>({ kind: "idle" });
  // CEFR can be overridden by the user when the lexicon returns null
  const [selectedCefr, setSelectedCefr] = useState<Cefr>("B1");
  const [addStatus, setAddStatus] = useState<AddStatus>("idle");

  async function handleLookup() {
    const word = query.trim();
    if (!word) return;

    setLookup({ kind: "loading" });
    setAddStatus("idle");

    try {
      const res = await fetch(`/api/lexicon/lookup?word=${encodeURIComponent(word)}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setLookup({ kind: "error", message: body.error ?? "Lookup failed" });
        return;
      }
      const data = (await res.json()) as
        | { found: true; word: string; definition: string; examples: string[]; cefr: Cefr | null }
        | { found: false; word: string };

      if (!data.found) {
        setLookup({ kind: "not-found", word: data.word });
        return;
      }

      setLookup({
        kind: "found",
        word: data.word,
        definition: data.definition,
        examples: data.examples,
        cefr: data.cefr,
      });
      setSelectedCefr(data.cefr ?? "B1");
    } catch {
      setLookup({ kind: "error", message: "Network error" });
    }
  }

  async function handleAdd() {
    if (lookup.kind !== "found") return;
    setAddStatus("adding");

    try {
      const repo = getContentRepository();
      const existing = await repo.getAllCards();
      if (
        isDuplicate(
          lookup.word,
          existing.map((c) => c.word),
        )
      ) {
        setAddStatus("duplicate");
        return;
      }

      const card = buildNewCard({
        word: lookup.word,
        definition: lookup.definition,
        examples: lookup.examples,
        cefr: selectedCefr,
      });
      await repo.addCard(card);
      setAddStatus("added");
      setQuery("");
      setLookup({ kind: "idle" });
    } catch {
      setAddStatus("idle");
    }
  }

  return (
    <div data-testid="add-word-form" className="w-full max-w-sm">
      <h2 className="text-foreground text-lg font-semibold">Add a word</h2>

      <div className="mt-4 flex gap-2">
        <input
          ref={inputRef}
          data-testid="word-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleLookup();
          }}
          placeholder="e.g. luminous"
          className="border-border bg-card text-foreground placeholder:text-muted focus:ring-accent h-10 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
        />
        <Button
          data-testid="btn-lookup"
          variant="secondary"
          size="md"
          disabled={!query.trim() || lookup.kind === "loading"}
          onClick={() => void handleLookup()}
        >
          {lookup.kind === "loading" ? "…" : "Look up"}
        </Button>
      </div>

      {/* Lookup result */}
      {lookup.kind === "found" && (
        <div data-testid="lookup-result" className="border-border mt-4 rounded-xl border p-4">
          <p className="text-foreground text-base font-semibold">{lookup.word}</p>
          <p className="text-muted mt-1 text-sm leading-6">{lookup.definition}</p>
          {lookup.examples.length > 0 && (
            <ul className="mt-2 space-y-1">
              {lookup.examples.map((ex, i) => (
                <li key={i} className="text-muted text-xs italic">
                  &ldquo;{ex}&rdquo;
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-center gap-3">
            <label className="text-muted text-xs font-medium">CEFR</label>
            <select
              data-testid="cefr-select"
              value={selectedCefr}
              onChange={(e) => setSelectedCefr(e.target.value as Cefr)}
              className="border-border bg-card text-foreground focus:ring-accent rounded-lg border px-2 py-1 text-xs focus:ring-2 focus:outline-none"
            >
              {CEFR_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {lookup.cefr === null && (
              <span className="text-warning text-xs">Not in CEFR data — please choose</span>
            )}
          </div>

          <Button
            data-testid="btn-add-to-deck"
            size="md"
            className="mt-4 w-full"
            disabled={addStatus === "adding" || addStatus === "added"}
            onClick={() => void handleAdd()}
          >
            {addStatus === "adding" ? "Adding…" : "Add to deck"}
          </Button>
        </div>
      )}

      {lookup.kind === "not-found" && (
        <p data-testid="msg-not-found" className="text-muted mt-3 text-sm">
          &ldquo;{lookup.word}&rdquo; was not found in the lexicon.
        </p>
      )}

      {lookup.kind === "error" && (
        <p data-testid="msg-error" className={cn("mt-3 text-sm", "text-danger")}>
          {lookup.message === "Lexicon unavailable"
            ? "Lexicon data not built. Run: node scripts/build-wordnet.mjs"
            : lookup.message}
        </p>
      )}

      {/* Add result banners */}
      {addStatus === "added" && (
        <p data-testid="msg-added" className="text-success mt-3 text-sm">
          Added to your deck!
        </p>
      )}
      {addStatus === "duplicate" && (
        <p data-testid="msg-duplicate" className="text-warning mt-3 text-sm">
          Already in your deck.
        </p>
      )}
    </div>
  );
}

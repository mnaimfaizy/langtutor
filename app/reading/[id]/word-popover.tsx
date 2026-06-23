"use client";

import { useRef, useState } from "react";

import { buildNewCard, isDuplicate } from "@/lib/deck";
import { DefineResponseSchema } from "@/lib/lexicon/define-response";
import type { DefineFound } from "@/lib/lexicon/define-response";
import { getContentRepository } from "@/lib/registry";
import { Popover, PopoverContent, PopoverInlineTrigger } from "@/ui/popover";

const POS_LABEL: Record<string, string> = { n: "noun", v: "verb", a: "adj", r: "adv" };

const CEFR_COLOR: Record<string, string> = {
  A1: "text-success",
  A2: "text-success",
  B1: "text-warning",
  B2: "text-warning",
  C1: "text-danger",
  C2: "text-danger",
};

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; data: DefineFound }
  | { status: "not-found" }
  | { status: "researching" }
  | { status: "offline" }
  | { status: "error" };

type AddState = "idle" | "adding" | "added" | "duplicate" | "error";

export function WordPopover({ word }: { word: string }) {
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const [addState, setAddState] = useState<AddState>("idle");
  const loadingRef = useRef(false);
  const researchingRef = useRef(false);

  async function load() {
    if (
      loadingRef.current ||
      state.status === "found" ||
      state.status === "not-found" ||
      state.status === "researching" ||
      state.status === "offline"
    )
      return;
    loadingRef.current = true;
    setState({ status: "loading" });

    const w = word.toLowerCase();
    const repo = getContentRepository();

    // 1. Cache hit — offline-first
    try {
      const cached = await repo.getLexiconEntry(w);
      if (cached) {
        const parsed = DefineResponseSchema.safeParse(cached.data);
        if (parsed.success) {
          setState(
            parsed.data.found ? { status: "found", data: parsed.data } : { status: "not-found" },
          );
          loadingRef.current = false;
          return;
        }
      }
    } catch {
      // Fall through to network
    }

    // 2. Fetch from API, cache result for offline
    try {
      const res = await fetch(`/api/lexicon/define?word=${encodeURIComponent(w)}`);
      if (!res.ok) {
        setState({ status: "error" });
        loadingRef.current = false;
        return;
      }
      const json: unknown = await res.json();
      const parsed = DefineResponseSchema.safeParse(json);
      if (!parsed.success) {
        setState({ status: "error" });
        loadingRef.current = false;
        return;
      }
      await repo.putLexiconEntry({ word: w, data: json, cachedAt: new Date() });
      setState(
        parsed.data.found ? { status: "found", data: parsed.data } : { status: "not-found" },
      );
    } catch {
      setState({ status: "error" });
    } finally {
      loadingRef.current = false;
    }
  }

  async function handleResearch() {
    if (researchingRef.current) return;
    researchingRef.current = true;
    setState({ status: "researching" });
    const w = word.toLowerCase();
    try {
      const res = await fetch("/api/agent/research-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: w }),
      });
      if (res.status === 502 || res.status === 503) {
        setState({ status: "offline" });
        return;
      }
      if (!res.ok) {
        setState({ status: "error" });
        return;
      }
      const json: unknown = await res.json();
      const parsed = DefineResponseSchema.safeParse(json);
      if (!parsed.success || !parsed.data.found) {
        setState({ status: "error" });
        return;
      }
      const repo = getContentRepository();
      await repo.putLexiconEntry({ word: w, data: json, cachedAt: new Date() });
      setState({ status: "found", data: parsed.data });
    } catch {
      setState({ status: "error" });
    } finally {
      researchingRef.current = false;
    }
  }

  async function handleAdd(data: DefineFound) {
    if (addState === "adding" || addState === "added" || addState === "duplicate") return;
    setAddState("adding");
    try {
      const repo = getContentRepository();
      const existing = await repo.getAllCards();
      if (
        isDuplicate(
          data.word,
          existing.map((c) => c.word),
        )
      ) {
        setAddState("duplicate");
        return;
      }
      const card = buildNewCard({
        word: data.word,
        definition: data.definition,
        examples: data.examples,
        cefr: data.cefr ?? "B1",
      });
      await repo.addCard(card);
      setAddState("added");
    } catch {
      setAddState("error");
    }
  }

  return (
    <Popover>
      <PopoverInlineTrigger onClick={() => void load()} data-testid="word-btn" aria-label={word}>
        {word}
      </PopoverInlineTrigger>
      <PopoverContent className="w-72">
        <PopoverBody
          state={state}
          word={word}
          addState={addState}
          onAdd={handleAdd}
          onResearch={handleResearch}
        />
      </PopoverContent>
    </Popover>
  );
}

function PopoverBody({
  state,
  word,
  addState,
  onAdd,
  onResearch,
}: {
  state: LookupState;
  word: string;
  addState: AddState;
  onAdd: (data: DefineFound) => void;
  onResearch: () => void;
}) {
  if (state.status === "idle" || state.status === "loading") {
    return <p className="text-muted text-sm">Loading…</p>;
  }
  if (state.status === "researching") {
    return <p className="text-muted text-sm">Researching…</p>;
  }
  if (state.status === "error") {
    return <p className="text-danger text-sm">Could not load definition.</p>;
  }
  if (state.status === "offline") {
    return (
      <div>
        <p className="text-foreground text-sm font-semibold">{word}</p>
        <p className="text-muted mt-1 text-sm" data-testid="offline-msg">
          Unavailable — connect to Mac.
        </p>
        <button
          onClick={onResearch}
          className="text-accent hover:text-accent/80 mt-2 text-xs transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
  if (state.status === "not-found") {
    return (
      <div>
        <p className="text-foreground text-sm font-semibold">{word}</p>
        <p className="text-muted mt-1 text-sm">Not in dictionary.</p>
        <button
          data-testid="btn-research"
          onClick={onResearch}
          className="text-accent hover:text-accent/80 mt-2 text-xs transition-colors"
        >
          Research with AI
        </button>
      </div>
    );
  }

  const { data } = state;
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-foreground text-sm font-semibold">{data.word}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {data.cefr && (
            <span
              className={`text-xs font-semibold tracking-wider uppercase ${CEFR_COLOR[data.cefr] ?? "text-muted"}`}
            >
              {data.cefr}
            </span>
          )}
          <span className="text-muted text-xs uppercase">{POS_LABEL[data.pos] ?? data.pos}</span>
        </div>
      </div>
      {data.phonetic && (
        <p className="text-muted text-xs" data-testid="word-phonetic">
          {data.phonetic}
        </p>
      )}
      <p className="text-foreground text-sm leading-5">{data.definition}</p>
      {data.examples.length > 0 && (
        <p className="text-muted text-xs italic">&ldquo;{data.examples[0]}&rdquo;</p>
      )}
      <div className="flex items-center justify-between gap-2 pt-1">
        {data.audioUrl && <AudioButton url={data.audioUrl} />}
        <AddToDeckButton addState={addState} onAdd={() => onAdd(data)} />
      </div>
    </div>
  );
}

function AudioButton({ url }: { url: string }) {
  function play() {
    new Audio(url).play().catch(() => undefined);
  }
  return (
    <button
      onClick={play}
      data-testid="btn-play-audio"
      className="text-accent hover:text-accent/80 flex items-center gap-1 text-xs transition-colors"
    >
      ▶ Play
    </button>
  );
}

const ADD_LABEL: Record<AddState, string> = {
  idle: "+ Add to deck",
  adding: "Adding…",
  added: "Added ✓",
  duplicate: "In deck",
  error: "Error",
};

function AddToDeckButton({ addState, onAdd }: { addState: AddState; onAdd: () => void }) {
  const done = addState === "added" || addState === "duplicate";
  return (
    <button
      data-testid="btn-add-to-deck"
      disabled={addState === "adding" || done}
      onClick={onAdd}
      className={`ml-auto text-xs transition-colors ${
        done
          ? "text-success cursor-default"
          : addState === "error"
            ? "text-danger"
            : "text-accent hover:text-accent/80"
      }`}
    >
      {ADD_LABEL[addState]}
    </button>
  );
}

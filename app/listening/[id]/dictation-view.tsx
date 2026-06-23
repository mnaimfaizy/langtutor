"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { Content } from "@/lib/db";
import { PassageSchema } from "@/lib/content/passage";
import { createListeningErrorEvents } from "@/lib/diagnostics";
import { computeWer } from "@/lib/diagnostics/wer";
import type { WerAlignment, WerResult } from "@/lib/diagnostics/wer";
import { getContentRepository } from "@/lib/registry";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";
import { TtsButton } from "@/ui/tts-button";

type Phase = "loading" | "ready" | "notFound" | "error";

const CEFR_COLOR: Record<string, string> = {
  A1: "text-success",
  A2: "text-success",
  B1: "text-warning",
  B2: "text-warning",
  C1: "text-danger",
  C2: "text-danger",
};

function werColor(wer: number): string {
  if (wer <= 0.2) return "text-success";
  if (wer <= 0.5) return "text-warning";
  return "text-danger";
}

function AlignmentToken({ token }: { token: WerAlignment }) {
  if (token.type === "correct") {
    return <span className="text-foreground">{token.ref}</span>;
  }
  if (token.type === "substitution") {
    return (
      <span>
        <s className="text-danger">{token.ref}</s>{" "}
        <span className="text-warning font-medium">({token.hyp})</span>
      </span>
    );
  }
  if (token.type === "deletion") {
    return <span className="bg-danger/10 text-danger rounded px-0.5 text-sm">[{token.ref}]</span>;
  }
  // insertion
  return <span className="bg-warning/10 text-warning rounded px-0.5 text-sm">+{token.hyp}</span>;
}

function WerDisplay({ result, referenceBody }: { result: WerResult; referenceBody: string }) {
  const pct = isFinite(result.wer) ? Math.round(result.wer * 100) : 100;

  return (
    <div data-testid="wer-result" className="mt-8 space-y-5">
      {/* Score summary */}
      <div className="border-border rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-muted text-xs font-medium tracking-wider uppercase">
              Word error rate
            </p>
            <p
              data-testid="wer-score"
              className={cn("mt-1 text-4xl font-bold", werColor(result.wer))}
            >
              {pct}
              <span className="text-muted text-lg font-normal">%</span>
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted text-xs font-medium tracking-wider uppercase">Errors</p>
            <p className="text-foreground mt-1">
              {result.substitutions}S · {result.deletions}D · {result.insertions}I
            </p>
          </div>
        </div>
      </div>

      {/* Alignment diff */}
      {result.alignment.length > 0 && (
        <div className="border-border rounded-xl border p-5">
          <p className="text-foreground mb-3 text-xs font-medium tracking-wider uppercase">
            Reference with corrections
          </p>
          <p className="text-foreground text-sm leading-8">
            {result.alignment.map((token, i) => (
              <span key={i}>
                {i > 0 && " "}
                <AlignmentToken token={token} />
              </span>
            ))}
          </p>
          <p className="text-muted mt-3 text-xs">
            <span className="text-danger">red strikethrough</span> = wrong word (yours in brackets)
            · <span className="text-danger">[red]</span> = missed word ·{" "}
            <span className="text-warning">+orange</span> = extra word
          </p>
        </div>
      )}

      {/* Reveal reference */}
      <details className="border-border rounded-xl border p-4">
        <summary className="text-muted cursor-pointer text-sm select-none">
          Show reference text
        </summary>
        <p className="text-foreground mt-3 text-sm leading-8 whitespace-pre-wrap">
          {referenceBody}
        </p>
      </details>
    </div>
  );
}

export function DictationView({ id }: { id: number }) {
  const [phase, setPhase] = useState<Phase>(() => (isNaN(id) || id <= 0 ? "notFound" : "loading"));
  const [content, setContent] = useState<Content | null>(null);
  const [transcript, setTranscript] = useState("");
  const [werResult, setWerResult] = useState<WerResult | null>(null);
  const checkInFlight = useRef(false);

  useEffect(() => {
    if (isNaN(id) || id <= 0) return;
    let active = true;
    void getContentRepository()
      .getContent(id)
      .then((row) => {
        if (!active) return;
        if (!row || row.type !== "passage") {
          setPhase("notFound");
        } else {
          setContent(row);
          setPhase("ready");
        }
      })
      .catch(() => {
        if (active) setPhase("error");
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function handleCheck() {
    if (checkInFlight.current || !content) return;
    checkInFlight.current = true;
    const parsed = PassageSchema.safeParse(content.payload);
    const body = parsed.success ? parsed.data.body : "";
    const result = computeWer(body, transcript);
    setWerResult(result);

    const repo = getContentRepository();
    const now = new Date();
    for (const event of createListeningErrorEvents(result.alignment, content.level, now)) {
      try {
        await repo.addErrorEvent(event);
      } catch {
        // partial write failure — continue logging remaining events
      }
    }
    checkInFlight.current = false;
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (phase === "notFound" || !content) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-foreground text-base font-semibold">Passage not found</p>
        <p className="text-muted mt-2 text-sm">It may have been removed or the link is invalid.</p>
        <Link href="/listening" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to Listening
          </Button>
        </Link>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-danger text-base font-semibold">Something went wrong</p>
        <Link href="/listening" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to Listening
          </Button>
        </Link>
      </div>
    );
  }

  const parsed = PassageSchema.safeParse(content.payload);
  const title = parsed.success ? parsed.data.title : content.topic;
  const body = parsed.success ? parsed.data.body : "";

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/listening"
          className="text-muted hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm transition-colors"
        >
          ← Listening
        </Link>

        <article data-testid="dictation-article" className="mt-2">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={cn(
                "text-xs font-semibold tracking-wider uppercase",
                CEFR_COLOR[content.level] ?? "text-muted",
              )}
            >
              {content.level}
            </span>
            <span className="text-muted text-xs capitalize">{content.topic}</span>
          </div>

          <h1
            data-testid="passage-title"
            className="text-foreground mt-2 text-2xl leading-snug font-semibold tracking-tight"
          >
            {title}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            <TtsButton text={body} />
            <p className="text-muted text-xs">Listen, then type what you heard below.</p>
          </div>
        </article>

        {/* Transcript input */}
        <div className="mt-8" data-testid="dictation-area">
          <label htmlFor="transcript" className="text-foreground mb-2 block text-sm font-medium">
            Your transcription
          </label>
          <textarea
            id="transcript"
            data-testid="transcript-input"
            rows={8}
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              setWerResult(null);
            }}
            placeholder="Type what you heard…"
            className="border-border bg-background text-foreground placeholder:text-muted focus:ring-accent w-full resize-y rounded-xl border px-4 py-3 text-sm leading-7 focus:ring-2 focus:outline-none"
          />
          <div className="mt-3 flex items-center gap-3">
            <Button
              data-testid="btn-check"
              onClick={() => void handleCheck()}
              disabled={transcript.trim().length === 0}
            >
              Check
            </Button>
            {werResult && (
              <Button
                variant="secondary"
                onClick={() => {
                  setTranscript("");
                  setWerResult(null);
                }}
              >
                Try again
              </Button>
            )}
          </div>
        </div>

        {werResult && <WerDisplay result={werResult} referenceBody={body} />}

        <div className="mt-10">
          <Link href="/listening">
            <Button variant="secondary" size="md">
              Back to Listening
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

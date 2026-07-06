"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { Content } from "@/lib/db";
import { PassageSchema } from "@/lib/content/passage";
import { createListeningErrorEvents } from "@/lib/diagnostics";
import { computeWer } from "@/lib/diagnostics/wer";
import type { WerResult } from "@/lib/diagnostics/wer";
import { getContentRepository } from "@/lib/registry";
import { CEFR_BADGE_VARIANT } from "@/lib/cefr";
import { Badge, BackLink, Button } from "@/ui";
import { TtsButton } from "@/ui/tts-button";
import { WerDisplay } from "@/ui/wer-display";

import { ComprehensionQuiz } from "@/app/comprehension-quiz";

type Phase = "loading" | "ready" | "notFound" | "error";

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
    try {
      const parsed = PassageSchema.safeParse(content.payload);
      const body = parsed.success ? parsed.data.body : "";
      const result = computeWer(body, transcript);
      setWerResult(result);

      if (body && isFinite(result.wer)) {
        const repo = getContentRepository();
        const now = new Date();
        for (const event of createListeningErrorEvents(result.alignment, content.level, now)) {
          try {
            await repo.addErrorEvent(event);
          } catch {
            // partial write failure — continue logging remaining events
          }
        }
      }
    } finally {
      checkInFlight.current = false;
    }
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
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <BackLink href="/listening" label="Listening" className="mb-6" />

        <article data-testid="dictation-article" className="mt-2">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant={CEFR_BADGE_VARIANT[content.level]}>{content.level}</Badge>
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
            className="border-border bg-card text-foreground placeholder:text-muted focus-visible:border-accent focus-visible:ring-accent focus-visible:ring-offset-background w-full resize-y rounded-xl border px-4 py-3 text-sm leading-7 transition-[colors,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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

        {werResult && (
          <WerDisplay result={werResult} scoreLabel="Dictation score" referenceBody={body} />
        )}

        <div className="border-border mt-10 border-t pt-8">
          <h2 className="text-foreground text-lg font-semibold">Comprehension</h2>
          <p className="text-muted mt-1 text-sm">
            Test how well you understood the passage by answering questions from memory.
          </p>
          <ComprehensionQuiz skill="listening" title={title} body={body} level={content.level} />
        </div>

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

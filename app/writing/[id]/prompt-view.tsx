"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { Content } from "@/lib/db";
import { FeedbackSchema } from "@/lib/content/feedback";
import type { Correction, FeedbackPayload } from "@/lib/content/feedback";
import { createWritingErrorEvents } from "@/lib/diagnostics";
import { PromptSchema } from "@/lib/content/prompt";
import { getContentRepository } from "@/lib/registry";
import { CEFR_COLOR } from "@/lib/cefr";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";
import { TtsButton } from "@/ui/tts-button";

type Phase = "loading" | "ready" | "notFound" | "error";
type SubmitPhase = "idle" | "submitting" | "done" | "error";

const SCORE_COLOR = (score: number) => {
  if (score >= 8) return "text-success";
  if (score >= 5) return "text-warning";
  return "text-danger";
};

function CorrectionCard({ correction }: { correction: Correction }) {
  return (
    <div className="border-border rounded-xl border p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="bg-danger/10 text-danger rounded-full px-2.5 py-0.5 text-xs font-medium">
          {correction.category}
        </span>
      </div>
      <div className="grid gap-1 text-sm">
        <p>
          <span className="text-muted font-medium">Original: </span>
          <span className="text-danger line-through">{correction.original}</span>
        </p>
        <p>
          <span className="text-muted font-medium">Corrected: </span>
          <span className="text-success font-medium">{correction.corrected}</span>
        </p>
      </div>
      <p className="text-muted mt-2 text-xs leading-6">{correction.explanation}</p>
    </div>
  );
}

function FeedbackPanel({
  feedback,
  onRevise,
}: {
  feedback: FeedbackPayload;
  onRevise: () => void;
}) {
  return (
    <div data-testid="feedback-panel" className="mt-8 space-y-5">
      <div className="border-border rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-muted text-xs font-medium tracking-wider uppercase">Overall score</p>
            <p className={cn("mt-1 text-4xl font-bold", SCORE_COLOR(feedback.overallScore))}>
              {feedback.overallScore}
              <span className="text-muted text-lg font-normal">/10</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted text-xs font-medium tracking-wider uppercase">Grade</p>
            <p className="text-foreground mt-1 text-lg font-semibold">{feedback.structuralGrade}</p>
          </div>
        </div>
      </div>

      {feedback.corrections.length === 0 ? (
        <p className="text-success text-sm font-medium">No errors found — great work!</p>
      ) : (
        <div className="space-y-3">
          <p className="text-foreground text-sm font-semibold">
            {feedback.corrections.length} correction
            {feedback.corrections.length !== 1 ? "s" : ""}
          </p>
          {feedback.corrections.map((c, i) => (
            <CorrectionCard key={i} correction={c} />
          ))}
        </div>
      )}

      <Button variant="secondary" size="md" onClick={onRevise} data-testid="btn-revise">
        Revise
      </Button>
    </div>
  );
}

export function PromptView({ id }: { id: number }) {
  const [phase, setPhase] = useState<Phase>(() => (isNaN(id) || id <= 0 ? "notFound" : "loading"));
  const [content, setContent] = useState<Content | null>(null);
  const [draft, setDraft] = useState("");
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (isNaN(id) || id <= 0) return;

    let active = true;
    void getContentRepository()
      .getContent(id)
      .then((row) => {
        if (!active) return;
        if (!row || row.type !== "prompt") {
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

  async function handleSubmit() {
    if (inFlight.current || draft.trim().length === 0 || !content) return;
    inFlight.current = true;
    setSubmitPhase("submitting");
    try {
      const res = await fetch("/api/writing/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, level: content.level }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { feedback: unknown };
      const parsed = FeedbackSchema.parse(data.feedback);
      setFeedback(parsed);
      setSubmitPhase("done");
      const repo = getContentRepository();
      const now = new Date();
      for (const event of createWritingErrorEvents(parsed.corrections, content.level, now)) {
        try {
          await repo.addErrorEvent(event);
        } catch {
          // partial write failure — continue logging remaining events
        }
      }
    } catch {
      setSubmitPhase("error");
    } finally {
      inFlight.current = false;
    }
  }

  function handleRevise() {
    setFeedback(null);
    setSubmitPhase("idle");
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
        <p className="text-foreground text-base font-semibold">Prompt not found</p>
        <p className="text-muted mt-2 text-sm">It may have been removed or the link is invalid.</p>
        <Link href="/writing" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to Writing
          </Button>
        </Link>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-danger text-base font-semibold">Something went wrong</p>
        <Link href="/writing" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to Writing
          </Button>
        </Link>
      </div>
    );
  }

  const parsedPayload = PromptSchema.safeParse(content.payload);
  const title = parsedPayload.success ? parsedPayload.data.title : content.topic;
  const instruction = parsedPayload.success ? parsedPayload.data.instruction : "";
  const context = parsedPayload.success ? parsedPayload.data.context : undefined;

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        {/* Back link */}
        <Link
          href="/writing"
          className="text-muted hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm transition-colors"
        >
          ← Writing
        </Link>

        {/* Prompt card */}
        <article data-testid="prompt-article" className="mt-2">
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
            <span className="text-muted/50 text-xs">·</span>
            <span className="text-muted text-xs capitalize">{content.source}</span>
          </div>

          <h1
            data-testid="prompt-title"
            className="text-foreground mt-2 text-2xl leading-snug font-semibold tracking-tight"
          >
            {title}
          </h1>

          {context && (
            <div className="border-accent/40 bg-accent/5 mt-5 rounded-xl border-l-4 px-4 py-3">
              <p className="text-foreground text-sm leading-7 italic">{context}</p>
            </div>
          )}

          <p data-testid="prompt-instruction" className="text-foreground mt-5 text-base leading-8">
            {instruction}
          </p>

          <TtsButton
            text={context ? `${context}. ${instruction}` : instruction}
            className="mt-3 -ml-2"
          />
        </article>

        {/* Draft area */}
        <div className="mt-8" data-testid="draft-area">
          <label htmlFor="draft" className="text-foreground mb-2 block text-sm font-medium">
            Your response
          </label>
          <textarea
            id="draft"
            rows={10}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your response here…"
            disabled={submitPhase === "submitting"}
            className="border-border bg-background text-foreground placeholder:text-muted focus:ring-accent w-full resize-y rounded-xl border px-4 py-3 text-sm leading-7 focus:ring-2 focus:outline-none disabled:opacity-60"
          />
          <div className="mt-3 flex items-center gap-3">
            {submitPhase !== "done" && (
              <Button
                onClick={() => void handleSubmit()}
                disabled={submitPhase === "submitting" || draft.trim().length === 0}
                data-testid="btn-submit"
              >
                {submitPhase === "submitting" ? "Getting feedback…" : "Get feedback"}
              </Button>
            )}
            {submitPhase === "error" && (
              <p className="text-danger text-sm">Could not get feedback — is the Mac reachable?</p>
            )}
          </div>
        </div>

        {/* Feedback panel */}
        {submitPhase === "done" && feedback && (
          <FeedbackPanel feedback={feedback} onRevise={handleRevise} />
        )}

        <div className="mt-8">
          <Link href="/writing">
            <Button variant="secondary" size="md">
              Back to Writing
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

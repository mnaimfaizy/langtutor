"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Content } from "@/lib/db";
import { PromptSchema } from "@/lib/content/prompt";
import { getContentRepository } from "@/lib/registry";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";

type Phase = "loading" | "ready" | "notFound" | "error";

const CEFR_COLOR: Record<string, string> = {
  A1: "text-success",
  A2: "text-success",
  B1: "text-warning",
  B2: "text-warning",
  C1: "text-danger",
  C2: "text-danger",
};

export function PromptView({ id }: { id: number }) {
  const [phase, setPhase] = useState<Phase>(() => (isNaN(id) || id <= 0 ? "notFound" : "loading"));
  const [content, setContent] = useState<Content | null>(null);

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

  const parsed = PromptSchema.safeParse(content.payload);
  const title = parsed.success ? parsed.data.title : content.topic;
  const instruction = parsed.success ? parsed.data.instruction : "";
  const context = parsed.success ? parsed.data.context : undefined;

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
        </article>

        {/* Draft area */}
        <div className="mt-8" data-testid="draft-area">
          <label htmlFor="draft" className="text-foreground mb-2 block text-sm font-medium">
            Your response
          </label>
          <textarea
            id="draft"
            rows={10}
            placeholder="Write your response here…"
            className="border-border bg-background text-foreground placeholder:text-muted focus:ring-accent w-full resize-y rounded-xl border px-4 py-3 text-sm leading-7 focus:ring-2 focus:outline-none"
          />
          <p className="text-muted mt-2 text-xs">
            Feedback and corrections available in the next update.
          </p>
        </div>

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

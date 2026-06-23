"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Content } from "@/lib/db";
import { PassageSchema } from "@/lib/content/passage";
import { getContentRepository } from "@/lib/registry";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";
import { ComprehensionQuiz } from "./comprehension-quiz";
import { WordPopover } from "./word-popover";

type Phase = "loading" | "ready" | "notFound" | "error";

const CEFR_COLOR: Record<string, string> = {
  A1: "text-success",
  A2: "text-success",
  B1: "text-warning",
  B2: "text-warning",
  C1: "text-danger",
  C2: "text-danger",
};

export function PassageView({ id }: { id: number }) {
  const [phase, setPhase] = useState<Phase>(() => (isNaN(id) || id <= 0 ? "notFound" : "loading"));
  const [content, setContent] = useState<Content | null>(null);

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
        <Link href="/reading" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to Reading
          </Button>
        </Link>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <p className="text-danger text-base font-semibold">Something went wrong</p>
        <Link href="/reading" className="mt-8">
          <Button variant="secondary" size="lg">
            Back to Reading
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
        {/* Back link */}
        <Link
          href="/reading"
          className="text-muted hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm transition-colors"
        >
          ← Reading
        </Link>

        {/* Passage */}
        <article data-testid="passage-article" className="mt-2">
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
            data-testid="passage-title"
            className="text-foreground mt-2 text-2xl leading-snug font-semibold tracking-tight"
          >
            {title}
          </h1>

          <p
            data-testid="passage-body"
            className="text-foreground mt-5 text-base leading-8 whitespace-pre-wrap"
          >
            {tokenize(body).map((token, i) =>
              token.isWord ? (
                <WordPopover key={i} word={token.value} />
              ) : (
                <span key={i}>{token.value}</span>
              ),
            )}
          </p>
        </article>

        {parsed.success && <ComprehensionQuiz title={title} body={body} level={content.level} />}

        <div className="mt-10">
          <Link href="/reading">
            <Button variant="secondary" size="md">
              Back to Reading
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function tokenize(text: string): Array<{ value: string; isWord: boolean }> {
  return text
    .split(/([a-zA-Z]+)/)
    .filter((v) => v !== "")
    .map((value) => ({ value, isWord: /^[a-zA-Z]+$/.test(value) }));
}

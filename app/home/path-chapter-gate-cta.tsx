"use client";

import type { ExperienceMode } from "@/lib/db";
import { Card, cn } from "@/ui";
import { TrophyIcon } from "../icons";

const MODE_COPY: Record<ExperienceMode, { title: string; body: string }> = {
  kid: {
    title: "Chapter check waiting",
    body: "You finished the basics! A teacher exam unlocks Level A1 — coming soon.",
  },
  adult: {
    title: "Chapter gate pending",
    body: "Pre-A1 is complete. Pass the chapter exam to unlock A1 (exam arrives in a later update).",
  },
};

/**
 * Shown on the home path when pre-A1 units are done but the chapter gate is not yet
 * passed (ADR 0043, issue #114). The real exam entry point lands in a later slice —
 * this CTA makes the hold visible and demoable.
 */
export function PathChapterGatePendingCta({ mode }: { mode: ExperienceMode }) {
  const copy = MODE_COPY[mode];
  const kid = mode === "kid";

  return (
    <Card
      data-testid="chapter-gate-pending-cta"
      variant="glass"
      className={cn(
        "border-accent/40 from-accent/10 via-gradient-via/10 to-gradient-to/10 flex items-center gap-3 bg-gradient-to-r",
        kid && "rounded-2xl",
      )}
    >
      <span
        className={cn(
          "bg-accent/20 text-accent flex shrink-0 items-center justify-center rounded-full",
          kid ? "size-12" : "size-9",
        )}
      >
        <TrophyIcon className={kid ? "size-6" : "size-5"} />
      </span>
      <div>
        <p className={cn("text-foreground font-semibold", kid ? "text-base" : "text-sm")}>
          {copy.title}
        </p>
        <p className={cn("text-muted mt-0.5", kid ? "text-sm" : "text-xs")}>{copy.body}</p>
      </div>
    </Card>
  );
}

"use client";

import type { ExperienceMode } from "@/lib/db";
import { Card, cn } from "@/ui";
import { SparklesIcon } from "../icons";

const MODE_COPY: Record<ExperienceMode, { title: string; body: string }> = {
  kid: {
    title: "Chapter still growing",
    body: "You finished every stop! New adventures are still being added for everyone — the chapter check opens when they are ready.",
  },
  adult: {
    title: "Chapter still growing",
    body: "Pre-A1 units are done, but later stages are not ready for the chapter exam yet. A1 unlocks once enrichment is marked ready.",
  },
};

/**
 * Shown on the home path when pre-A1 is complete but shared stages are not yet
 * admin-ready for exam (ADR 0054 / issue #128). Not a link — waiting, not stuck.
 */
export function PathChapterGrowingBanner({ mode }: { mode: ExperienceMode }) {
  const copy = MODE_COPY[mode];
  const kid = mode === "kid";

  return (
    <Card
      variant="glass"
      data-testid="chapter-growing-banner"
      className={cn(
        "border-border/70 from-foreground/[0.04] via-gradient-via/5 to-gradient-to/5 flex items-center gap-3 border-dashed bg-gradient-to-r",
        kid && "rounded-2xl",
      )}
    >
      <span
        className={cn(
          "bg-foreground/10 text-muted flex shrink-0 items-center justify-center rounded-full",
          kid ? "size-12" : "size-9",
        )}
      >
        <SparklesIcon className={kid ? "size-6" : "size-5"} />
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

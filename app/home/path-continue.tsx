"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ExperienceMode, Unit } from "@/lib/db";
import { resolveUnitResumeTarget } from "@/lib/path/resume";
import { firstPendingActivityIndex } from "@/lib/path/unit-progress";
import { getContentRepository } from "@/lib/registry";
import { Button, Card, cn } from "@/ui";
import { ACTIVITY_LABEL } from "../path/activity-display";

// One-tap continue (issue #62): resumes exactly where the learner left off — the current
// unit's first pending activity — without a stop at the unit's own activity list first.
// Mode-driven copy only (no code fork): kid mode reads as an invitation to play, adult mode
// as a plain resume action, from the same component and the same resolution logic the unit
// view itself uses (`lib/path/resume.ts`).

const MODE_COPY: Record<ExperienceMode, { heading: string; cta: string }> = {
  kid: { heading: "Ready for today's adventure?", cta: "Let's go!" },
  adult: { heading: "Continue your learning path", cta: "Continue" },
};

export function PathContinue({ unit, mode }: { unit: Unit; mode: ExperienceMode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const kid = mode === "kid";
  const copy = MODE_COPY[mode];

  const nextIndex = firstPendingActivityIndex(unit);
  const nextSkill = unit.activities[nextIndex]?.skill;

  async function handleContinue() {
    setBusy(true);
    setPaused(false);
    try {
      const target = await resolveUnitResumeTarget(getContentRepository(), unit);
      router.push(target ? target.href : `/path/${unit.id}`);
    } catch {
      // Same authoritative-reachability-signal pattern as the unit view (ADR 0015, #61):
      // a generation failure means the Mac is unreachable, not a bug — offer alternatives
      // inline instead of failing silently or dropping into an unrelated error state.
      setPaused(true);
    } finally {
      setBusy(false);
    }
  }

  if (paused) {
    return (
      <Card
        data-testid="path-continue-paused"
        variant="glass"
        className={cn("text-center", kid && "rounded-2xl")}
      >
        <p className="text-foreground text-sm font-semibold">You&apos;re all caught up for now</p>
        <p className="text-muted mt-2 text-sm">
          This activity needs the Mac, and it isn&apos;t reachable right now. Your progress is
          saved.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link href="/review">
            <Button variant="gradient" size="sm">
              Review vocabulary
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setPaused(false)}>
            Dismiss
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      data-testid="path-continue"
      variant="glass"
      className={cn("flex flex-wrap items-center justify-between gap-4", kid && "rounded-2xl")}
    >
      <div>
        <p className={cn("text-foreground font-semibold", kid ? "text-lg" : "text-sm")}>
          {copy.heading}
        </p>
        {nextSkill && (
          <p className="text-muted mt-1 text-sm">
            {unit.title} — {ACTIVITY_LABEL[nextSkill]}
          </p>
        )}
      </div>
      <Button
        data-testid="path-continue-btn"
        variant="gradient"
        size={kid ? "lg" : "md"}
        disabled={busy}
        onClick={() => void handleContinue()}
      >
        {busy ? "Preparing…" : copy.cta}
      </Button>
    </Card>
  );
}

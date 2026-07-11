"use client";

import Link from "next/link";

import {
  DEFAULT_PROGRESSION_MODE,
  type ChapterGateStatus,
  type ExperienceMode,
  type ProgressionMode,
} from "@/lib/db";
import { preA1ChapterGateCtaHref } from "@/lib/path/chapter-gate";
import { Card, cn } from "@/ui";
import { TrophyIcon } from "../icons";

type CtaKind = "pending" | "failed_review" | "ready_retake";

const MODE_COPY: Record<ExperienceMode, Record<CtaKind, { title: string; body: string }>> = {
  kid: {
    pending: {
      title: "Chapter check waiting",
      body: "You finished the basics! Take the teacher exam to unlock Level A1.",
    },
    failed_review: {
      title: "Review with your teacher",
      body: "Finish your practice checklist, then try the exam again.",
    },
    ready_retake: {
      title: "Ready to retake!",
      body: "Review done — pass the chapter exam to unlock Level A1.",
    },
  },
  adult: {
    pending: {
      title: "Chapter gate pending",
      body: "Pre-A1 is complete. Pass the chapter exam to unlock A1.",
    },
    failed_review: {
      title: "Review assignment waiting",
      body: "Complete the teacher’s review checklist before you retake the exam.",
    },
    ready_retake: {
      title: "Retake available",
      body: "Review complete. Pass the chapter exam to unlock A1.",
    },
  },
};

/** Open-mode adults still get the exam CTA — feedback without blocking A1 (issue #119). */
const ADULT_OPEN_PENDING = {
  title: "Chapter exam available",
  body: "Pre-A1 is complete. Take the exam for a teacher report — A1 stays open either way.",
} as const;

function ctaKind(status: ChapterGateStatus): CtaKind {
  if (status === "failed_review") return "failed_review";
  if (status === "ready_retake") return "ready_retake";
  return "pending";
}

function ctaCopy(
  mode: ExperienceMode,
  kind: CtaKind,
  progressionMode: ProgressionMode,
): { title: string; body: string } {
  if (mode === "adult" && progressionMode === "open" && kind === "pending") {
    return ADULT_OPEN_PENDING;
  }
  return MODE_COPY[mode][kind];
}

/**
 * Shown on the home path when pre-A1 units are done but the chapter gate is not yet
 * passed (ADR 0043, issues #114–#119). Links into the exam or review checklist.
 * Open mode still offers the CTA for feedback; only the A1 block differs.
 */
export function PathChapterGatePendingCta({
  mode,
  gateStatus = "pending",
  progressionMode = DEFAULT_PROGRESSION_MODE,
}: {
  mode: ExperienceMode;
  gateStatus?: ChapterGateStatus;
  /** Effective progression mode (kids always resolve to strict upstream). */
  progressionMode?: ProgressionMode;
}) {
  const kind = ctaKind(gateStatus);
  const copy = ctaCopy(mode, kind, progressionMode);
  const kid = mode === "kid";
  const href = preA1ChapterGateCtaHref(gateStatus);

  return (
    <Link
      href={href}
      data-testid="chapter-gate-pending-cta"
      data-gate-status={gateStatus}
      className="block focus-visible:outline-none"
    >
      <Card
        variant="glass"
        className={cn(
          "border-accent/40 from-accent/10 via-gradient-via/10 to-gradient-to/10 flex items-center gap-3 bg-gradient-to-r transition-opacity hover:opacity-95",
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
    </Link>
  );
}

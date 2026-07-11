"use client";

import Link from "next/link";

import type { ChapterGateStatus, ExperienceMode } from "@/lib/db";
import { preA1ChapterGateCtaHref } from "@/lib/path/chapter-gate";
import { Card, cn } from "@/ui";
import { TrophyIcon } from "../icons";

const MODE_COPY: Record<
  ExperienceMode,
  Record<"pending" | "failed_review" | "ready_retake", { title: string; body: string }>
> = {
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

function ctaKind(status: ChapterGateStatus): "pending" | "failed_review" | "ready_retake" {
  if (status === "failed_review") return "failed_review";
  if (status === "ready_retake") return "ready_retake";
  return "pending";
}

/**
 * Shown on the home path when pre-A1 units are done but the chapter gate is not yet
 * passed (ADR 0043, issues #114–#117). Links into the exam or review checklist.
 */
export function PathChapterGatePendingCta({
  mode,
  gateStatus = "pending",
}: {
  mode: ExperienceMode;
  gateStatus?: ChapterGateStatus;
}) {
  const kind = ctaKind(gateStatus);
  const copy = MODE_COPY[mode][kind];
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

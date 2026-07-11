/**
 * Pre-A1 chapter exam buffer decisions (ADR 0037, issue #118).
 *
 * Pure and side-effect free: decides whether replenishment should pre-fill the next
 * chapter exam, whether a gate is paused offline, and whether an online retake should
 * prefer a fresh fill. Persistence lives in `buffer-store.ts`; orchestration in
 * `lib/path/replenish.ts`.
 */
import type { ChapterGateStatus, Unit } from "@/lib/db";

import {
  isPreA1ChapterComplete,
  resolveChapterGateStatus,
  shouldShowPreA1ChapterGatePendingCta,
} from "../chapter-gate";
import { isPreA1ExamStartAllowed } from "./review-assignment";

/** Cached, playable exam fill ready for offline take (distinct from scored attempts). */
export const PRE_A1_EXAM_BUFFER_TOPIC = "chapter-exam-buffer:pre-A1";

/** Queued teacher-report job when AI was unreachable at submit time. */
export const PRE_A1_EXAM_DEFERRED_REPORT_TOPIC = "chapter-exam-report-deferred:pre-A1";

/**
 * True when the learner is at (or past) the pre-A1 gate and still needs a playable exam —
 * replenishment should keep a filled buffer when the provider is reachable.
 */
export function shouldBufferPreA1Exam(args: {
  units: readonly Unit[];
  gateStatus: ChapterGateStatus | undefined;
  hasBufferedExam: boolean;
}): boolean {
  if (args.hasBufferedExam) return false;
  const status = resolveChapterGateStatus(
    args.gateStatus !== undefined ? { status: args.gateStatus } : undefined,
  );
  if (status === "passed") return false;
  if (!isPreA1ChapterComplete(args.units)) return false;
  return isPreA1ExamStartAllowed(status);
}

/**
 * Graceful pause at the pre-A1 gate (ADR 0037): gate needed, buffer empty, provider
 * unreachable. Never unlocks A1 — caller must not treat pause as a pass.
 */
export function isPreA1ExamGatePaused(args: {
  units: readonly Unit[];
  gateStatus: ChapterGateStatus | undefined;
  hasBufferedExam: boolean;
  providerReachable: boolean;
}): boolean {
  if (args.providerReachable || args.hasBufferedExam) return false;
  const status = resolveChapterGateStatus(
    args.gateStatus !== undefined ? { status: args.gateStatus } : undefined,
  );
  if (!shouldShowPreA1ChapterGatePendingCta({ units: args.units, gateStatus: status })) {
    return false;
  }
  // Only pause when the learner could otherwise start the exam (pending / ready_retake).
  // During failed_review they go to the checklist, which needs no AI fill.
  return isPreA1ExamStartAllowed(status);
}

/**
 * When online, prefer a freshly filled attempt for retakes (and first attempts) so the
 * buffer stays a fallback rather than a stale forever-reuse. Offline always uses the buffer.
 */
export function preferFreshExamFill(args: {
  providerReachable: boolean;
  /** Retakes especially should not reuse a stale failed attempt when online. */
  isRetake: boolean;
}): boolean {
  void args.isRetake;
  return args.providerReachable;
}

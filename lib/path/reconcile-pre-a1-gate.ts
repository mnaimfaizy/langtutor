/**
 * Reconcile A1 unlock after shared catalog readiness changes (issue #128 / ADR 0054).
 *
 * Completing placeholders while stages are not ready holds A1. When an admin later marks
 * stages ready-for-exam, learners who already finished pre-A1 need a home/path visit to
 * unlock A1 in open mode (strict still waits on the exam).
 */
import type { ContentRepository } from "@/lib/db";

import {
  PRE_A1_CHAPTER_TIER,
  arePreA1StagesReadyForExam,
  isA1BlockedByPreA1Gate,
  isPreA1ChapterComplete,
  resolveChapterGateStatus,
} from "./chapter-gate";

/**
 * If pre-A1 is complete and stages are exam-ready, ensure a pending gate row exists and
 * unlock locked A1 unit 0 when the gate no longer blocks (open mode, or strict + passed).
 */
export async function reconcilePreA1ChapterBoundary(repo: ContentRepository): Promise<void> {
  const units = await repo.getUnits();
  if (!isPreA1ChapterComplete(units)) return;

  const stages = await repo.getSharedPathStages();
  const stagesReadyForExam = arePreA1StagesReadyForExam(stages);
  if (!stagesReadyForExam) return;

  const existing = await repo.getChapterGate(PRE_A1_CHAPTER_TIER);
  if (!existing) {
    await repo.saveChapterGate({
      tier: PRE_A1_CHAPTER_TIER,
      status: "pending",
      updatedAt: new Date(),
      reviewAssignment: null,
    });
  }

  const unit0 = units.find((u) => u.index === 0);
  if (!unit0 || unit0.status !== "locked") return;

  const profile = await repo.getProfile();
  const gate = existing ?? (await repo.getChapterGate(PRE_A1_CHAPTER_TIER));
  const blocked = isA1BlockedByPreA1Gate({
    profile: profile ?? { experienceMode: undefined, settings: {} },
    units,
    gateStatus: resolveChapterGateStatus(gate),
    stagesReadyForExam: true,
  });
  if (!blocked) {
    await repo.updateUnit(unit0.id, { status: "available" });
  }
}

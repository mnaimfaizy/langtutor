/**
 * Chapter mastery-gate helpers (ADR 0033–0035, 0042–0043, 0054–0055, issues #114/#117/#128).
 *
 * Pure and side-effect free: callers persist gate rows via ContentRepository and decide
 * unlocks in `completeUnitActivity` / `reconcilePreA1ChapterBoundary`. This module answers
 * "what's the effective mode?", "are shared stages exam-ready?", "should A1 stay locked?",
 * "should the home exam CTA show?", and "should the chapter-growing state show?".
 */
import {
  DEFAULT_EXPERIENCE_MODE,
  DEFAULT_PROGRESSION_MODE,
  PRE_A1_STAGE_IDS,
  type ChapterGate,
  type ChapterGateStatus,
  type ChapterTier,
  type Profile,
  type ProgressionMode,
  type SharedPathStage,
  type Unit,
} from "@/lib/db";

import { isPreA1Unit, unitTier } from "./pre-a1";

/** Kids are always strict; adults use the stored setting (default strict). */
export function effectiveProgressionMode(
  profile: Pick<Profile, "experienceMode" | "settings">,
): ProgressionMode {
  const experience = profile.experienceMode ?? DEFAULT_EXPERIENCE_MODE;
  if (experience === "kid") return "strict";
  return profile.settings.progressionMode ?? DEFAULT_PROGRESSION_MODE;
}

/** Missing row means the gate has not been passed yet. */
export function resolveChapterGateStatus(
  gate: Pick<ChapterGate, "status"> | undefined,
): ChapterGateStatus {
  return gate?.status ?? "pending";
}

/**
 * Admin enrichment bar (ADR 0055): every required pre-A1 stage must carry
 * `readyForExam: true` on the shared catalog. Missing stage rows → not ready.
 */
export function arePreA1StagesReadyForExam(
  stages: readonly Pick<SharedPathStage, "id" | "readyForExam">[],
): boolean {
  const byId = new Map(stages.map((s) => [s.id, s.readyForExam]));
  return PRE_A1_STAGE_IDS.every((id) => byId.get(id) === true);
}

/**
 * Effective enrichment readiness for one learner (ADR 0056). Shared stages must be
 * admin-ready for new completers; an existing gate row grandfathers learners who
 * already entered the exam lifecycle (including legacy four-unit profiles).
 */
export function resolveStagesReadyForExam(
  stages: readonly Pick<SharedPathStage, "id" | "readyForExam">[],
  gate: Pick<ChapterGate, "status"> | undefined,
): boolean {
  if (gate != null) return true;
  return arePreA1StagesReadyForExam(stages);
}

/** Completing @completedUnit would unlock the first unit of a different chapter. */
export function isChapterBoundaryUnlock(completedUnit: Unit, nextUnit: Unit): boolean {
  return unitTier(completedUnit) !== unitTier(nextUnit);
}

/** Pre-A1 → A1 is the only boundary this slice gates. */
export function isPreA1ToA1Boundary(completedUnit: Unit, nextUnit: Unit): boolean {
  return isPreA1Unit(completedUnit) && !isPreA1Unit(nextUnit);
}

/**
 * Hold the unlock across the pre-A1 → A1 boundary until shared stages are exam-ready
 * (all modes) and — in strict mode — until the chapter gate is passed.
 * Within-pre-A1 unlocks are never held.
 */
export function shouldHoldUnlockForChapterGate(args: {
  completedUnit: Unit;
  nextUnit: Unit;
  progressionMode: ProgressionMode;
  gateStatus: ChapterGateStatus;
  stagesReadyForExam: boolean;
}): boolean {
  if (!isPreA1ToA1Boundary(args.completedUnit, args.nextUnit)) return false;
  // Placeholders alone must not unlock A1 (ADR 0054) — open and strict alike.
  if (!args.stagesReadyForExam) return true;
  if (args.gateStatus === "passed") return false;
  if (args.progressionMode !== "strict") return false;
  return true;
}

/** True once every pre-A1 unit on the path is completed (empty pre-A1 set → false). */
export function isPreA1ChapterComplete(units: readonly Unit[]): boolean {
  const preA1 = units.filter(isPreA1Unit);
  return preA1.length > 0 && preA1.every((u) => u.status === "completed");
}

/**
 * Home exam CTA: pre-A1 finished, stages admin-ready, and the chapter gate is not yet
 * passed. Independent of progression mode once offered — open mode still surfaces the
 * exam for feedback without blocking A1 (issue #119 / #128).
 */
export function shouldShowPreA1ChapterGatePendingCta(args: {
  units: readonly Unit[];
  gateStatus: ChapterGateStatus;
  stagesReadyForExam: boolean;
}): boolean {
  if (!args.stagesReadyForExam) return false;
  if (!isPreA1ChapterComplete(args.units)) return false;
  return args.gateStatus !== "passed";
}

/**
 * Home "chapter still growing" state: pre-A1 finished but shared enrichment bar not
 * cleared — exam is not offered yet (ADR 0054).
 */
export function shouldShowPreA1ChapterGrowingState(args: {
  units: readonly Unit[];
  gateStatus: ChapterGateStatus;
  stagesReadyForExam: boolean;
}): boolean {
  if (args.gateStatus === "passed") return false;
  if (!isPreA1ChapterComplete(args.units)) return false;
  return !args.stagesReadyForExam;
}

/**
 * Is A1 unit 0 blocked at the pre-A1 boundary?
 * Blocked while stages are not exam-ready (all modes), or in strict mode while the
 * gate is not passed once the exam is offered.
 */
export function isA1BlockedByPreA1Gate(args: {
  profile: Pick<Profile, "experienceMode" | "settings">;
  units: readonly Unit[];
  gateStatus: ChapterGateStatus;
  stagesReadyForExam: boolean;
}): boolean {
  if (!isPreA1ChapterComplete(args.units)) return false;
  if (!args.stagesReadyForExam) return true;
  if (effectiveProgressionMode(args.profile) !== "strict") return false;
  return args.gateStatus !== "passed";
}

/** Home CTA href for the current pre-A1 gate lifecycle (issue #117). */
export function preA1ChapterGateCtaHref(gateStatus: ChapterGateStatus): string {
  if (gateStatus === "failed_review") return "/path/exam/pre-a1/review";
  return "/path/exam/pre-a1";
}

export const PRE_A1_CHAPTER_TIER: ChapterTier = "pre-A1";

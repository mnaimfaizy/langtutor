/**
 * Chapter mastery-gate helpers (ADR 0033–0035, 0042–0043, issues #114/#117).
 *
 * Pure and side-effect free: callers persist gate rows via ContentRepository and decide
 * unlocks in `completeUnitActivity`. This module only answers "what's the effective mode?",
 * "should A1 stay locked?", and "should the home CTA show?".
 */
import {
  DEFAULT_EXPERIENCE_MODE,
  DEFAULT_PROGRESSION_MODE,
  type ChapterGate,
  type ChapterGateStatus,
  type ChapterTier,
  type Profile,
  type ProgressionMode,
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

/** Completing @completedUnit would unlock the first unit of a different chapter. */
export function isChapterBoundaryUnlock(completedUnit: Unit, nextUnit: Unit): boolean {
  return unitTier(completedUnit) !== unitTier(nextUnit);
}

/** Pre-A1 → A1 is the only boundary this slice gates. */
export function isPreA1ToA1Boundary(completedUnit: Unit, nextUnit: Unit): boolean {
  return isPreA1Unit(completedUnit) && !isPreA1Unit(nextUnit);
}

/**
 * Strict mode holds the unlock across the pre-A1 → A1 boundary until the chapter gate
 * is marked passed. Within-pre-A1 unlocks and open mode are never held.
 */
export function shouldHoldUnlockForChapterGate(args: {
  completedUnit: Unit;
  nextUnit: Unit;
  progressionMode: ProgressionMode;
  gateStatus: ChapterGateStatus;
}): boolean {
  if (args.progressionMode !== "strict") return false;
  if (!isPreA1ToA1Boundary(args.completedUnit, args.nextUnit)) return false;
  return args.gateStatus !== "passed";
}

/** True once every pre-A1 unit on the path is completed (empty pre-A1 set → false). */
export function isPreA1ChapterComplete(units: readonly Unit[]): boolean {
  const preA1 = units.filter(isPreA1Unit);
  return preA1.length > 0 && preA1.every((u) => u.status === "completed");
}

/**
 * Home CTA: pre-A1 finished and the chapter gate is not yet passed. Independent of
 * progression mode — open mode still surfaces the exam entry point for feedback
 * without blocking A1 (issue #119).
 * Adults with pre-A1 disabled have no pre-A1 units, so this is false for them.
 */
export function shouldShowPreA1ChapterGatePendingCta(args: {
  units: readonly Unit[];
  gateStatus: ChapterGateStatus;
}): boolean {
  if (!isPreA1ChapterComplete(args.units)) return false;
  return args.gateStatus !== "passed";
}

/** Strict-mode answer to "is A1 unit 0 blocked by the pre-A1 chapter gate?". */
export function isA1BlockedByPreA1Gate(args: {
  profile: Pick<Profile, "experienceMode" | "settings">;
  units: readonly Unit[];
  gateStatus: ChapterGateStatus;
}): boolean {
  if (effectiveProgressionMode(args.profile) !== "strict") return false;
  return shouldShowPreA1ChapterGatePendingCta({
    units: args.units,
    gateStatus: args.gateStatus,
  });
}

/** Home CTA href for the current pre-A1 gate lifecycle (issue #117). */
export function preA1ChapterGateCtaHref(gateStatus: ChapterGateStatus): string {
  if (gateStatus === "failed_review") return "/path/exam/pre-a1/review";
  return "/path/exam/pre-a1";
}

export const PRE_A1_CHAPTER_TIER: ChapterTier = "pre-A1";

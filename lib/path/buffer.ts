/**
 * Path-buffer state (ADR 0015, glossary "Path buffer"; issue #61). Pure and side-effect
 * free: derives buffer readiness from a unit's own fields and decides what a replenishment
 * pass should plan/generate next, given the current path and a buffer depth. Orchestration
 * (the actual network calls) lives in `lib/path/replenish.ts`; this module never touches the
 * network or the repository.
 */
import type { Unit, UnitActivityRef, UnitBufferStatus } from "@/lib/db";

import { firstPendingActivityIndex } from "./unit-progress";

/**
 * Default number of future units the path keeps pre-generated and ready to play offline
 * (ADR 0015). Proposed and accepted as 3 (issue #61 HITL) — small enough that a single
 * replenishment pass (bounded by `UNITS_TO_PLAN_PER_PASS` for planning) can keep it full in
 * one go, large enough to cover a multi-day trip away from the Mac. Bump this constant if the
 * default ever needs to change; there is no env var for it (a fixed, reviewable code value
 * matches the existing `UNITS_TO_PLAN_PER_PASS` convention in `lib/path/teacher-planner.ts`
 * rather than adding user-facing settings for an internal tuning knob).
 */
export const PATH_BUFFER_DEPTH = 3;

/**
 * Whether one activity slot's content is ready to play with no network call. `review` slots
 * need no generated content (they operate on the global SRS deck); every other kind needs a
 * generated `contentId` (issue #59/#60's lazy generate-and-cache pattern).
 */
export function isActivityReady(activity: UnitActivityRef): boolean {
  return (
    activity.skill === "review" || activity.skill === "alphabet" || activity.contentId !== undefined
  );
}

/**
 * Derives a unit's buffer status from its own fields: `"buffered"` once the teacher has
 * planned it (non-empty `targetVocab`) **and** every activity slot is ready; `"empty"`
 * otherwise (unplanned backbone placeholder, or planned but only partially generated).
 * Pure — callers persist the result via `ContentRepository.updateUnit`.
 */
export function computeUnitBufferStatus(
  unit: Pick<Unit, "targetVocab" | "activities">,
): UnitBufferStatus {
  if (unit.targetVocab.length === 0) return "empty";
  return unit.activities.every(isActivityReady) ? "buffered" : "empty";
}

/** Not-yet-reached units (backbone `locked`/`available`), ascending by path order. */
function futureUnits(units: readonly Unit[]): Unit[] {
  return units
    .filter((u) => u.status === "locked" || u.status === "available")
    .slice()
    .sort((a, b) => a.index - b.index);
}

/** What a replenishment pass should do next, given the current path and buffer depth. */
export interface ReplenishmentPlan {
  /** Future units within the buffer window that still need a teacher plan. */
  toPlan: Unit[];
  /** Future, already-planned units within the buffer window that aren't fully buffered yet. */
  toGenerateContent: Unit[];
}

/**
 * Pure replenishment decision: looks at the next @depth future units and splits them into
 * "needs planning" and "needs content generation" — the two steps a replenishment pass runs
 * (`lib/path/replenish.ts`). A unit already `"buffered"` appears in neither list. Units beyond
 * the depth window, and units that are `in-progress`/`completed`, are never touched — the
 * buffer only ever looks ahead, never at the unit currently being played.
 */
export function decideReplenishment(
  units: readonly Unit[],
  depth: number = PATH_BUFFER_DEPTH,
): ReplenishmentPlan {
  const window = futureUnits(units).slice(0, Math.max(depth, 0));
  return {
    toPlan: window.filter((u) => u.targetVocab.length === 0),
    toGenerateContent: window.filter(
      (u) => u.targetVocab.length > 0 && computeUnitBufferStatus(u) !== "buffered",
    ),
  };
}

/** The unit the learner would resume/start next: `in-progress` if one exists, else `available`. */
export function currentPlayableUnit(units: readonly Unit[]): Unit | undefined {
  return (
    units.find((u) => u.status === "in-progress") ?? units.find((u) => u.status === "available")
  );
}

/** Whether @unit's next pending activity would need an on-demand generation call to start. */
export function nextActivityNeedsGeneration(unit: Unit): boolean {
  const activity = unit.activities[firstPendingActivityIndex(unit)];
  return activity !== undefined && !isActivityReady(activity);
}

/**
 * Whether the path should show the graceful-pause state (ADR 0015): the learner's current
 * unit can't proceed without a network call to the AI provider, and the provider is
 * unreachable. Never pauses while the provider is reachable, and never pauses a unit whose
 * next activity is already buffered — that one just plays, online or off.
 */
export function isPathPaused(currentUnit: Unit | undefined, providerReachable: boolean): boolean {
  if (providerReachable || !currentUnit) return false;
  return nextActivityNeedsGeneration(currentUnit);
}

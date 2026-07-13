/**
 * Pre-A1 tier path plumbing (ADR 0016 / 0049–0053, issues #66 / #125). Negative-index
 * units ahead of unit 0 materialize from the shared path catalog — same four-stage
 * skeleton for every kid / enablePreA1 adult, with no LLM on day one.
 */
import {
  DEFAULT_EXPERIENCE_MODE,
  type Cefr,
  type NewUnit,
  type Profile,
  type Unit,
} from "@/lib/db";

import {
  buildBundledSharedPathUnitTemplates,
  materializePreA1UnitsFromCatalog,
} from "./shared-path-catalog";

export {
  alphabetActivities,
  listenTapActivities,
  phonicsActivities,
  pictureMatchActivities,
} from "./pre-a1-activities";

export { PRE_A1_UNIT_COUNT, PRE_A1_FIRST_PATH_INDEX } from "./shared-path-catalog";

/** Display / chapter tier — negative-index units are pre-A1 regardless of `targetCefr`. */
export type PathTier = Cefr | "pre-A1";

export function isPreA1Unit(unit: Pick<Unit, "index">): boolean {
  return unit.index < 0;
}

export function unitTier(unit: Unit): PathTier {
  return isPreA1Unit(unit) ? "pre-A1" : unit.targetCefr;
}

/**
 * True once the learner has handed off into A1 — started or finished unit 0, or finished every
 * pre-A1 unit (unit 0 will unlock next). A freshly seeded path with unit 0 still `available`
 * and no pre-A1 units yet is not considered "reached".
 */
export function hasReachedFirstA1Unit(units: readonly Unit[]): boolean {
  const firstA1 = units.find((u) => u.index === 0);
  if (!firstA1) return false;
  if (firstA1.status === "in-progress" || firstA1.status === "completed") return true;

  const preA1 = units.filter((u) => u.index < 0);
  if (preA1.length === 0) return false;

  return preA1.every((u) => u.status === "completed");
}

/**
 * Whether this profile should have pre-A1 units seeded. Kid mode always opts in at the A1
 * floor; adult mode requires an explicit settings toggle.
 */
export function shouldSeedPreA1(profile: Profile, anchorLevel: Cefr): boolean {
  if (anchorLevel !== "A1") return false;
  const mode = profile.experienceMode ?? DEFAULT_EXPERIENCE_MODE;
  if (mode === "kid") return true;
  return profile.settings.enablePreA1 === true;
}

/**
 * Whether the kid-only Pre-A1 home (the illustrated island trail) should render instead of
 * the standard path home. Kid-only regardless of adult pre-A1 opt-in (`shouldSeedPreA1`) —
 * the island is a kid-specific presentation, not a pre-A1-tier one. Reuses
 * `hasReachedFirstA1Unit` so the handoff to the standard home is driven by the same unlock
 * state machine as the rest of the path — no separate flag to keep in sync.
 */
export function shouldShowKidIsland(
  profile: Pick<Profile, "experienceMode">,
  units: readonly Unit[],
): boolean {
  const mode = profile.experienceMode ?? DEFAULT_EXPERIENCE_MODE;
  return mode === "kid" && !hasReachedFirstA1Unit(units);
}

/**
 * Deterministic shared starter units (ADR 0053). Pure — no LLM. Uses the bundled catalog
 * templates so two fresh profiles always receive identical structure.
 */
export function seedPreA1Units(now: Date = new Date()): NewUnit[] {
  return materializePreA1UnitsFromCatalog(buildBundledSharedPathUnitTemplates(), now);
}

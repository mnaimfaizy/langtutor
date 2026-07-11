/**
 * Pre-A1 tier path plumbing (ADR 0016, issue #66). Backbone placeholder units at negative
 * indices ahead of unit 0 — real activity content arrives in later slices; this slice proves
 * the tier, adult opt-in, and handoff into A1 via the existing unlock state machine.
 */
import {
  DEFAULT_EXPERIENCE_MODE,
  type Cefr,
  type NewUnit,
  type Profile,
  type Unit,
  type UnitActivityRef,
} from "@/lib/db";

import { backboneActivities } from "./backbone-planner";

/** Display / chapter tier — negative-index units are pre-A1 regardless of `targetCefr`. */
export type PathTier = Cefr | "pre-A1";

/** Single alphabet activity slot for the first pre-A1 unit (issue #71). */
export function alphabetActivities(): UnitActivityRef[] {
  return [{ skill: "alphabet" }];
}

/** Single phonics activity slot for the second pre-A1 unit (issue #72). */
export function phonicsActivities(): UnitActivityRef[] {
  return [{ skill: "phonics" }];
}

/** Single picture-match activity slot for the third pre-A1 unit (issue #74). */
export function pictureMatchActivities(): UnitActivityRef[] {
  return [{ skill: "picture-match" }];
}

/** Single listen-and-tap activity slot for the fourth pre-A1 unit (issue #73). */
export function listenTapActivities(): UnitActivityRef[] {
  return [{ skill: "listen-tap" }];
}

/** Placeholder backbone topics for the four pre-A1 activity slices (issues #71–#74). */
const PRE_A1_TOPICS = [
  { title: "Alphabet", note: "Learn letters, sounds, and pictures." },
  { title: "Phonics", note: "Connect sounds to letters and words." },
  { title: "Picture words", note: "Match pictures and words." },
  { title: "Listen & tap", note: "Listen and tap the right choice." },
] as const;

export const PRE_A1_UNIT_COUNT = PRE_A1_TOPICS.length;

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

/** Deterministic backbone placeholders at indices `-count … -1`; only the first unlocks. */
export function seedPreA1Units(now: Date = new Date()): NewUnit[] {
  return PRE_A1_TOPICS.map((topic, i) => ({
    index: i - PRE_A1_UNIT_COUNT,
    title: `Pre-A1: ${topic.title}`,
    teacherNote: topic.note,
    targetGrammarIds: [],
    targetVocab: [],
    targetCefr: "A1",
    activities:
      i === 0
        ? alphabetActivities()
        : i === 1
          ? phonicsActivities()
          : i === 2
            ? pictureMatchActivities()
            : i === 3
              ? listenTapActivities()
              : backboneActivities(),
    status: i === 0 ? "available" : "locked",
    bufferStatus: "empty",
    createdAt: now,
  }));
}

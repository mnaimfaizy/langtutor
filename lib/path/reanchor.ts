/**
 * Pure future-unit re-anchoring (ADR 0015, issue #63).
 *
 * When the learner's CEFR level changes (a placement redo or a manual Settings edit — a
 * future self-refining CEFR mechanism would feed the same seam), the path must re-anchor
 * its not-yet-reached units to the backbone at the new level without ever touching what
 * the learner has already done. This module makes that decision — which future units keep
 * their current backbone anchor and which need a fresh one — and is deliberately as dumb
 * as the initial backbone seeder it mirrors (`lib/path/backbone-planner.ts`): deterministic,
 * offline, no LLM/network call.
 *
 * A unit's `index` already encodes its fixed position in the curriculum sequence (the
 * seeder assigns it once and nothing since has ever renumbered a unit — ADR 0015/#57), so
 * re-anchoring is just: "what construction would a fresh backbone seed at the new level put
 * at this unit's index?" Reusing `index` this way is what keeps the learner's position on
 * the path stable across the change — the path never grows, shrinks, or reorders, only the
 * not-yet-reached units' *content* changes (PRD: "no jarring reset of position").
 *
 * Clearing a changed unit's `targetVocab`/activities resets it to an unplanned, unbuffered
 * backbone placeholder — the existing teacher planner (issue #58) and buffer replenishment
 * (issue #61) pick it up on their very next pass, exactly like a freshly seeded unit. This
 * module therefore never calls the LLM itself; "provider unreachable ⇒ re-planning defers
 * gracefully" falls out of the existing planner/buffer resilience for free.
 *
 * Edge case: if the new level starts far enough into the grammar map that a future unit's
 * index runs past the map's last construction (C2's final entry), there is nothing to
 * re-anchor it to, so it is left untouched rather than deleted — `ContentRepository` has no
 * unit-delete seam, and reaching this only happens once the learner is nearly through the
 * whole curriculum.
 */
import type { GrammarConstruction, GrammarMap } from "@/lib/content/grammar-map";
import { GRAMMAR_MAP } from "@/lib/content/grammar-map";
import type { Cefr, ContentRepository, NewUnit, Profile, Unit } from "@/lib/db";

import { backboneActivities } from "./backbone-planner";

/** One future unit's re-anchor decision: the patch to persist via `ContentRepository.updateUnit`. */
export interface UnitReanchor {
  unitId: number;
  changes: Pick<
    NewUnit,
    | "title"
    | "teacherNote"
    | "targetGrammarIds"
    | "targetVocab"
    | "targetCefr"
    | "activities"
    | "bufferStatus"
  >;
}

/** Future (not completed, not in-progress) units — the only ones re-anchoring ever touches. */
function futureUnits(units: readonly Unit[]): Unit[] {
  return units.filter((u) => u.status === "locked" || u.status === "available");
}

/** The construction a fresh backbone seed at @level would place at curriculum position @index. */
function constructionAtIndex(
  grammarMap: GrammarMap,
  level: Cefr,
  index: number,
): GrammarConstruction | undefined {
  const startIndex = grammarMap.findIndex((c) => c.cefr === level);
  if (startIndex === -1) return undefined;
  return grammarMap[startIndex + index];
}

/**
 * Decides which of @units' future units need re-anchoring to @newLevel. Completed and
 * in-progress units are never inspected — the completed/in-progress invariant holds by
 * construction (they're excluded from `futureUnits`), not by a separate check. Returns one
 * patch per unit that actually needs to change; a unit already anchored correctly —
 * including the whole-path no-op when the level change doesn't move any future unit's
 * construction — is omitted entirely, preserving its existing plan/buffer untouched.
 */
export function reanchorFutureUnits(
  units: readonly Unit[],
  newLevel: Cefr,
  grammarMap: GrammarMap = GRAMMAR_MAP,
): UnitReanchor[] {
  const patches: UnitReanchor[] = [];

  for (const unit of futureUnits(units)) {
    const construction = constructionAtIndex(grammarMap, newLevel, unit.index);
    if (!construction) continue; // past the end of the curriculum — nothing to re-anchor to
    if (unit.targetGrammarIds[0] === construction.id) continue; // already correct — no-op

    patches.push({
      unitId: unit.id,
      changes: {
        title: `Unit ${unit.index + 1}: ${construction.label}`,
        teacherNote: construction.description,
        targetGrammarIds: [construction.id],
        targetVocab: [],
        targetCefr: construction.cefr,
        activities: backboneActivities(),
        bufferStatus: "empty",
      },
    });
  }

  return patches;
}

/** Persists every patch {@link reanchorFutureUnits} decides on. No-op if nothing needs to change. */
export async function applyReanchor(
  repo: ContentRepository,
  newLevel: Cefr,
  grammarMap?: GrammarMap,
): Promise<void> {
  const units = await repo.getUnits();
  const patches = reanchorFutureUnits(units, newLevel, grammarMap);
  for (const { unitId, changes } of patches) {
    await repo.updateUnit(unitId, changes);
  }
}

/**
 * Detects a CEFR/placement change between @previous and @next and re-anchors the path's
 * future units if so — the hook `repoSaveProfile` (issue #63) calls on every profile save,
 * whether it came from the onboarding placement quiz or a Settings edit. A profile's very
 * first save (`previous` has no level yet) is onboarding, not a "change" — the backbone
 * seeder (`lib/path/seed.ts`) owns seeding that first path, not this module.
 */
export async function reanchorOnProfileChange(
  repo: ContentRepository,
  previous: Profile | undefined,
  next: Profile,
): Promise<void> {
  if (!previous?.cefrLevel || !next.cefrLevel) return;
  if (previous.cefrLevel === next.cefrLevel) return;
  await applyReanchor(repo, next.cefrLevel);
}

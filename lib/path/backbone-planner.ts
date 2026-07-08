/**
 * Backbone-only path planner (ADR 0015, issue #57 — path skeleton).
 *
 * Pure and deterministic: seeds an initial learning path from the static backbone (the
 * 39-entry grammar map, which already progresses A1 → C2 in curriculum order) anchored at
 * the learner's CEFR level. No LLM/network call — the LLM teacher (`lib/path/teacher-planner.ts`,
 * issue #58) fills in richer titles/notes/vocab and adapts the plan once wired up.
 */
import { GRAMMAR_MAP, type GrammarMap } from "@/lib/content/grammar-map";
import type { ActivityKind, Cefr, NewUnit, UnitActivityRef } from "@/lib/db";

/**
 * Fixed, deterministic ordering for the placeholder activity slots in a backbone unit. All
 * five module types are wired end-to-end (unit player, issue #59; full coverage, issue #60):
 * a quick vocabulary review, then listening and reading input, then writing and speaking
 * output — the composed session the LLM teacher (#58) builds a unit plan around.
 */
const ACTIVITY_KIND_ORDER: readonly ActivityKind[] = [
  "review",
  "listening",
  "reading",
  "writing",
  "speaking",
];

/** A fresh, unplanned/unbuffered activity slot list — also reused by re-anchoring (issue #63)
 * to reset a future unit back to a backbone placeholder. */
export function backboneActivities(): UnitActivityRef[] {
  return ACTIVITY_KIND_ORDER.map((skill) => ({ skill }));
}

/**
 * Seeds the initial path: one unit per grammar-map construction from @anchorLevel through
 * C2, in map order. Only the first unit unlocks (`available`); every later unit starts
 * `locked` (workstream 3 — the LLM teacher — will adapt unlock timing later).
 *
 * The pre-A1 tier (ADR 0016) uses negative indices ahead of unit 0 — see
 * `lib/path/pre-a1.ts` for that seeding. This function only produces A1+ backbone units
 * starting at index 0.
 *
 * @param anchorLevel the learner's current CEFR level (from onboarding/placement).
 * @param grammarMap injectable for tests; defaults to the real 39-entry map.
 * @param now injectable clock for deterministic tests; defaults to the current time.
 */
export function seedBackbonePath(
  anchorLevel: Cefr,
  grammarMap: GrammarMap = GRAMMAR_MAP,
  now: Date = new Date(),
): NewUnit[] {
  const startIndex = grammarMap.findIndex((construction) => construction.cefr === anchorLevel);
  const constructions = startIndex === -1 ? [] : grammarMap.slice(startIndex);

  return constructions.map((construction, i) => ({
    index: i,
    title: `Unit ${i + 1}: ${construction.label}`,
    teacherNote: construction.description,
    targetGrammarIds: [construction.id],
    targetVocab: [],
    targetCefr: construction.cefr,
    activities: backboneActivities(),
    status: i === 0 ? "available" : "locked",
    bufferStatus: "empty",
    createdAt: now,
  }));
}

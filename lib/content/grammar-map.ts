import { z } from "zod";

import type { Cefr } from "@/lib/db";

import _rawMap from "@/data/grammar-map.json";

/** A single grammar construction entry in the progression map. */
export interface GrammarConstruction {
  /** Stable snake_case identifier — used as the lookup key. */
  id: string;
  /** Human-readable name shown in UI and diagnostics. */
  label: string;
  /** CEFR level at which this construction is introduced. */
  cefr: Cefr;
  /** One-sentence pedagogical description. */
  description: string;
  /**
   * Regex pattern strings (JSON-escaped) used as detection heuristics in
   * {@link ContentValidator}. Not intended to be exhaustive — false positives
   * are acceptable; false negatives trigger a corrective retry.
   */
  markers: string[];
  /** Representative sentences illustrating the construction. */
  examples: string[];
}

export type GrammarMap = readonly GrammarConstruction[];

// Zod schema for runtime validation of grammar-map.json entries.
// Catches authoring typos (e.g. cefr:"B3") at module load rather than silently
// returning undefined from CEFR_RANK and suppressing all violations.
const GrammarConstructionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  cefr: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  description: z.string().min(1),
  markers: z.array(z.string()),
  examples: z.array(z.string()),
});

/** The full authored grammar progression map (A1 → C2), loaded at module import time. */
export const GRAMMAR_MAP: GrammarMap = z
  .array(GrammarConstructionSchema)
  .parse(_rawMap) as GrammarMap;

// ── query helpers ────────────────────────────────────────────────────────────

/** Construction record for @id, or undefined if not in the map. */
export function lookupConstruction(
  id: string,
  map: GrammarMap = GRAMMAR_MAP,
): GrammarConstruction | undefined {
  return map.find((c) => c.id === id);
}

/** CEFR level at which construction @id is introduced, or null if unknown. */
export function grammarLevel(id: string, map: GrammarMap = GRAMMAR_MAP): Cefr | null {
  return lookupConstruction(id, map)?.cefr ?? null;
}

/** All constructions introduced at exactly @cefr. */
export function constructionsByLevel(
  cefr: Cefr,
  map: GrammarMap = GRAMMAR_MAP,
): GrammarConstruction[] {
  return map.filter((c) => c.cefr === cefr);
}

/** Count of constructions per CEFR level — used for coverage snapshots. */
export function levelCoverage(map: GrammarMap = GRAMMAR_MAP): Record<Cefr, number> {
  const acc: Partial<Record<Cefr, number>> = {};
  for (const c of map) acc[c.cefr] = (acc[c.cefr] ?? 0) + 1;
  return acc as Record<Cefr, number>;
}

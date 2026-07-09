import type { Cefr } from "@/lib/db";
import type { MasteryLabel } from "@/lib/srs";
import { masteryLabelFromState } from "@/lib/srs";

/** CEFR levels in ascending difficulty order. */
export const CEFR_MASTERY_LEVELS: readonly Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Mastery buckets shown in the breakdown (FSRS learner-facing phases). */
export const CEFR_MASTERY_LABELS: readonly MasteryLabel[] = [
  "new",
  "learning",
  "review",
  "relearning",
];

/** Minimal card shape for client-side CEFR mastery derivation. */
export interface CefrMasteryCard {
  cefr: Cefr;
  fsrsState: number;
  suspended?: boolean;
}

export type CefrMasteryCounts = Record<MasteryLabel, number>;

export interface CefrMasteryLevelRow {
  level: Cefr;
  counts: CefrMasteryCounts;
  total: number;
}

function emptyCounts(): CefrMasteryCounts {
  return { new: 0, learning: 0, review: 0, relearning: 0 };
}

/**
 * Groups non-suspended deck cards by CEFR level and FSRS mastery phase.
 * Returns one row per level (A1–C2), including levels with zero cards.
 */
export function computeCefrMasteryBreakdown(cards: CefrMasteryCard[]): CefrMasteryLevelRow[] {
  const byLevel = new Map<Cefr, CefrMasteryCounts>();
  for (const level of CEFR_MASTERY_LEVELS) {
    byLevel.set(level, emptyCounts());
  }

  for (const card of cards) {
    if (card.suspended) continue;
    const counts = byLevel.get(card.cefr);
    if (!counts) continue;
    const label = masteryLabelFromState(card.fsrsState);
    counts[label] += 1;
  }

  return CEFR_MASTERY_LEVELS.map((level) => {
    const counts = byLevel.get(level) ?? emptyCounts();
    const total = CEFR_MASTERY_LABELS.reduce((sum, label) => sum + counts[label], 0);
    return { level, counts, total };
  });
}

/** Human-readable summary for a mastery segment (tooltip / aria). */
export function formatCefrMasterySegmentLabel(
  level: Cefr,
  mastery: MasteryLabel,
  count: number,
): string {
  if (count === 0) return "";
  const phase = mastery.charAt(0).toUpperCase() + mastery.slice(1);
  return `${level} · ${phase}: ${count} card${count === 1 ? "" : "s"}`;
}

/**
 * Level-milestone grouping for the visual journey (ADR 0015/0017, issue #62). The static
 * backbone (`lib/path/backbone-planner.ts`) produces units in ascending `index` order with
 * units for the same CEFR level contiguous (it walks the grammar map, itself ordered A1 → C2),
 * so grouping consecutive same-level units into "chapters" needs no separate sort — just a
 * single pass preserving encounter order.
 *
 * Pure and side-effect free: the path renderer (`app/home/learning-path.tsx`) turns
 * {@link PathChapter.isComplete} into the chapter-complete moment on the path (finishing a
 * level milestone, e.g. all A1 units, so A1 → A2 feels like an achievement).
 */
import type { Unit } from "@/lib/db";

import { type PathTier, unitTier } from "./pre-a1";

export interface PathChapter {
  tier: PathTier;
  units: Unit[];
  /** True once every unit in this chapter is `completed`. A chapter with no units is never complete. */
  isComplete: boolean;
}

/** Groups @units into consecutive-by-tier chapters, preserving their given order. */
export function groupUnitsByChapter(units: readonly Unit[]): PathChapter[] {
  const chapters: PathChapter[] = [];

  for (const unit of units) {
    const tier = unitTier(unit);
    const current = chapters[chapters.length - 1];
    if (current && current.tier === tier) {
      current.units.push(unit);
    } else {
      chapters.push({ tier, units: [unit], isComplete: false });
    }
  }

  for (const chapter of chapters) {
    chapter.isComplete = chapter.units.every((u) => u.status === "completed");
  }

  return chapters;
}

/**
 * Returns the chapter tier whose final unit is @unitId and is now fully complete, or null when
 * completing @unitId did not finish a chapter (issue #84).
 */
export function chapterTierCompletedByUnit(
  units: readonly Unit[],
  unitId: number,
): PathChapter["tier"] | null {
  for (const chapter of groupUnitsByChapter(units)) {
    if (!chapter.isComplete) continue;
    const last = chapter.units[chapter.units.length - 1];
    if (last?.id === unitId) return chapter.tier;
  }
  return null;
}

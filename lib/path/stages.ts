/**
 * Pre-A1 stage grouping for path / Kid Island presentation (ADR 0050 / 0053, issue #127).
 *
 * Learner `Unit` rows carry path indices only; stage identity and richness live on the shared
 * catalog. These helpers resolve catalog metadata so UIs can group many small units into the
 * four skill-family stages without a dry linear checklist.
 */
import type { PreA1StageId, SharedPathUnitRichness, Unit } from "@/lib/db";

import { isPreA1Unit } from "./pre-a1";
import {
  buildBundledSharedPathStages,
  buildBundledSharedPathUnitTemplates,
  stageIdForPathIndex,
} from "./shared-path-catalog";

export interface PathStageGroup {
  stageId: PreA1StageId;
  title: string;
  /** Kid Island place name — entertainment register, not a checklist label. */
  islandLabel: string;
  richness: SharedPathUnitRichness;
  units: Unit[];
  isComplete: boolean;
}

const ISLAND_LABELS: Record<PreA1StageId, string> = {
  alphabet: "Letter Shore",
  phonics: "Phonics Cove",
  "picture-words": "Picture Bay",
  "listen-tap": "Listen Lagoon",
};

/** Friendly stage blurb shown under placeholder stage headers (adult + kid chrome). */
export const PLACEHOLDER_STAGE_BLURB =
  "A light preview stop — richer adventures grow here for everyone later.";

/** Friendly stage blurb for richly authored stages. */
export const RICH_STAGE_BLURB = "Full adventure ready — play every stop on this shore.";

export function richnessForPathIndex(pathIndex: number): SharedPathUnitRichness | undefined {
  return buildBundledSharedPathUnitTemplates().find((t) => t.pathIndex === pathIndex)?.richness;
}

/**
 * Short map/path label: drop the shared "Pre-A1: Stage —" prefix so nodes read as story stops,
 * not a syllabus checklist.
 */
export function shortUnitTitle(title: string): string {
  const emDash = title.indexOf(" — ");
  if (emDash >= 0) {
    const tail = title.slice(emDash + 3).trim();
    if (tail) return tail;
  }
  const stripped = title.replace(/^Pre-A1:\s*/i, "").trim();
  return stripped || title;
}

function stageTitle(stageId: PreA1StageId): string {
  return (
    buildBundledSharedPathStages().find((s) => s.id === stageId)?.title ??
    ISLAND_LABELS[stageId] ??
    stageId
  );
}

function stageRichness(stageId: PreA1StageId, units: readonly Unit[]): SharedPathUnitRichness {
  const fromCatalog = buildBundledSharedPathUnitTemplates().filter((t) => t.stageId === stageId);
  if (fromCatalog.length > 0) {
    return fromCatalog.every((t) => t.richness === "placeholder") ? "placeholder" : "rich";
  }
  // Fallback when units are not in the bundled catalog (tests with ad-hoc indices).
  const unitRichness = units.map((u) => richnessForPathIndex(u.index));
  if (unitRichness.length > 0 && unitRichness.every((r) => r === "placeholder")) {
    return "placeholder";
  }
  return "rich";
}

/**
 * Groups contiguous pre-A1 units into the four skill-family stages (path-index order).
 * Non–pre-A1 units are ignored — callers keep A1+ chapters via {@link groupUnitsByChapter}.
 */
export function groupPreA1UnitsByStage(units: readonly Unit[]): PathStageGroup[] {
  const preA1 = units
    .filter(isPreA1Unit)
    .slice()
    .sort((a, b) => a.index - b.index);
  const groups: PathStageGroup[] = [];

  for (const unit of preA1) {
    const stageId = stageIdForPathIndex(unit.index);
    if (!stageId) continue;
    const current = groups[groups.length - 1];
    if (current && current.stageId === stageId) {
      current.units.push(unit);
    } else {
      groups.push({
        stageId,
        title: stageTitle(stageId),
        islandLabel: ISLAND_LABELS[stageId],
        richness: "rich",
        units: [unit],
        isComplete: false,
      });
    }
  }

  for (const group of groups) {
    group.richness = stageRichness(group.stageId, group.units);
    group.isComplete = group.units.length > 0 && group.units.every((u) => u.status === "completed");
  }

  return groups;
}

/**
 * Splits a full path into pre-A1 stage groups plus the remaining (A1+) units in encounter order.
 */
export function splitUnitsByPreA1Stages(units: readonly Unit[]): {
  stages: PathStageGroup[];
  afterPreA1: Unit[];
} {
  return {
    stages: groupPreA1UnitsByStage(units),
    afterPreA1: units.filter((u) => !isPreA1Unit(u)),
  };
}

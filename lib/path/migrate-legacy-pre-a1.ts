/**
 * Migrate legacy four-unit pre-A1 paths onto the shared multi-unit starter (issue #130 /
 * ADR 0056). Idempotent: no-ops when the path is already the shared catalog shape.
 */
import type {
  ChapterGate,
  ChapterReviewAssignment,
  ContentRepository,
  NewUnit,
  PreA1StageId,
  SharedPathUnitTemplate,
  Unit,
  UnitStatus,
} from "@/lib/db";
import { PRE_A1_STAGE_IDS } from "@/lib/db";

import { PRE_A1_CHAPTER_TIER } from "./chapter-gate";
import {
  buildBundledSharedPathUnitTemplates,
  ensureSharedPathCatalogSeeded,
  reviewPathIndexForStage,
} from "./shared-path-catalog";

/** Inventory: pre-shared-catalog starter had exactly four single-activity units. */
export const LEGACY_PRE_A1_UNIT_COUNT = 4;
export const LEGACY_PRE_A1_FIRST_PATH_INDEX = -LEGACY_PRE_A1_UNIT_COUNT;

const LEGACY_TITLES = [
  "Pre-A1: Alphabet",
  "Pre-A1: Phonics",
  "Pre-A1: Picture words",
  "Pre-A1: Listen & tap",
] as const;

const LEGACY_PRIMARY_SKILLS = ["alphabet", "phonics", "picture-match", "listen-tap"] as const;

/** Legacy path index (−4…−1) → skill-family stage on the shared starter. */
export const LEGACY_INDEX_TO_STAGE: Record<number, PreA1StageId> = {
  [-4]: "alphabet",
  [-3]: "phonics",
  [-2]: "picture-words",
  [-1]: "listen-tap",
};

/**
 * True when @units hold the old four-unit pre-A1 ladder (indices −4…−1 with legacy
 * titles or primary skills). Shared-catalog starters (six units / new titles) return false.
 */
export function isLegacyFourUnitPreA1Path(units: readonly Unit[]): boolean {
  const preA1 = units
    .filter((u) => u.index < 0)
    .slice()
    .sort((a, b) => a.index - b.index);
  if (preA1.length !== LEGACY_PRE_A1_UNIT_COUNT) return false;
  if (!preA1.every((u, i) => u.index === i - LEGACY_PRE_A1_UNIT_COUNT)) return false;
  return preA1.every((u, i) => {
    if (u.title === LEGACY_TITLES[i]) return true;
    return u.activities[0]?.skill === LEGACY_PRIMARY_SKILLS[i];
  });
}

/**
 * Map legacy unit statuses onto shared-catalog `NewUnit` rows (path-index order).
 * Does not touch A1+ units or emit completion events.
 */
export function mapLegacyProgressToSharedStarter(
  legacyPreA1: readonly Unit[],
  templates: readonly SharedPathUnitTemplate[],
  now: Date = new Date(),
): NewUnit[] {
  const sortedLegacy = legacyPreA1.slice().sort((a, b) => a.index - b.index);
  const stageStatus = new Map<PreA1StageId, UnitStatus>();
  for (const unit of sortedLegacy) {
    const stageId = LEGACY_INDEX_TO_STAGE[unit.index];
    if (stageId) stageStatus.set(stageId, unit.status);
  }

  const approved = (templates.length > 0 ? templates : buildBundledSharedPathUnitTemplates())
    .filter((t) => t.tier === "pre-A1" && t.approvalStatus === "approved")
    .slice()
    .sort((a, b) => a.pathIndex - b.pathIndex);

  const firstIndexByStage = new Map<PreA1StageId, number>();
  for (const t of approved) {
    if (!firstIndexByStage.has(t.stageId)) firstIndexByStage.set(t.stageId, t.pathIndex);
  }

  return approved.map((t) => {
    const legacyStatus = stageStatus.get(t.stageId) ?? "locked";
    const isFirstOfStage = firstIndexByStage.get(t.stageId) === t.pathIndex;

    let status: UnitStatus;
    let activities: NewUnit["activities"];

    if (legacyStatus === "completed") {
      status = "completed";
      activities = t.activities.map((a) => ({ skill: a.skill, done: true }));
    } else if (legacyStatus === "locked") {
      status = "locked";
      activities = t.activities.map((a) => ({ skill: a.skill }));
    } else if (isFirstOfStage) {
      // available / in-progress — resume at the first catalog unit of the stage.
      status = legacyStatus;
      activities = t.activities.map((a) => ({ skill: a.skill }));
    } else {
      status = "locked";
      activities = t.activities.map((a) => ({ skill: a.skill }));
    }

    return {
      index: t.pathIndex,
      title: t.title,
      teacherNote: t.teacherNote,
      targetGrammarIds: [],
      targetVocab: t.targetVocab.slice(),
      targetCefr: "A1" as const,
      activities,
      status,
      bufferStatus: "empty" as const,
      createdAt: now,
    };
  });
}

/** Remap old −4…−1 review targets onto current stage review path indices. */
export function remapLegacyReviewAssignment(
  assignment: ChapterReviewAssignment,
): ChapterReviewAssignment {
  return {
    ...assignment,
    items: assignment.items.map((item) => {
      const stageId = LEGACY_INDEX_TO_STAGE[item.unitIndex];
      if (!stageId) return item;
      return { ...item, unitIndex: reviewPathIndexForStage(stageId) };
    }),
  };
}

/**
 * Replace legacy four-unit pre-A1 rows with the shared starter, preserving gate status
 * and unit-0 unlock. Returns true when a migration ran.
 */
export async function migrateLegacyPreA1Units(repo: ContentRepository): Promise<boolean> {
  const units = await repo.getUnits();
  if (!isLegacyFourUnitPreA1Path(units)) return false;

  await ensureSharedPathCatalogSeeded(repo);
  const templates = await repo.querySharedPathUnitTemplates({
    tier: "pre-A1",
    approvalStatus: "approved",
  });

  const legacyPreA1 = units.filter((u) => u.index < 0);
  const replacements = mapLegacyProgressToSharedStarter(legacyPreA1, templates);

  for (const unit of legacyPreA1) {
    await repo.deleteUnit(unit.id);
  }
  for (const unit of replacements) {
    await repo.addUnit(unit);
  }

  const gate = await repo.getChapterGate(PRE_A1_CHAPTER_TIER);
  if (gate?.reviewAssignment) {
    await repo.saveChapterGate({
      ...gate,
      reviewAssignment: remapLegacyReviewAssignment(gate.reviewAssignment),
    } satisfies ChapterGate);
  }

  return true;
}

/** Stage ids covered by the legacy four-unit inventory (documentation / tests). */
export function legacyPreA1StageInventory(): readonly PreA1StageId[] {
  return PRE_A1_STAGE_IDS;
}

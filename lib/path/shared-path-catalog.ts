/**
 * Shared pre-A1 path catalog (ADR 0049–0053, issue #125).
 *
 * Bundled human-authored starter templates are the day-one source of truth. They are
 * upserted into ContentRepository's shared catalog so every new kid / enablePreA1 adult
 * materializes the same four-stage skeleton — no LLM, no admin wait on first login.
 */
import type {
  ContentRepository,
  NewUnit,
  PreA1StageId,
  SharedPathStage,
  SharedPathUnitTemplate,
  UnitActivityRef,
} from "@/lib/db";

import {
  alphabetActivities,
  listenTapActivities,
  phonicsActivities,
  pictureMatchActivities,
} from "./pre-a1-activities";

const TIER = "pre-A1" as const;
const CATALOG_EPOCH = new Date("2026-07-01T00:00:00.000Z");

/** Spine section keys from `data/curriculum-guides/pre-a1/spine.json` (issue #124). */
export const PRE_A1_STAGE_SPINE_KEYS: Record<PreA1StageId, string> = {
  alphabet: "spine.stages.alphabet",
  phonics: "spine.stages.phonics",
  "picture-words": "spine.stages.picture-words",
  "listen-tap": "spine.stages.listen-tap",
};

type StarterUnitDef = {
  id: string;
  stageId: PreA1StageId;
  stageOrder: number;
  title: string;
  teacherNote: string;
  activities: UnitActivityRef[];
  richness: SharedPathUnitTemplate["richness"];
  targetVocab?: string[];
};

/**
 * Product-authored starter ladder (ADR 0053): rich Alphabet / letters & sounds runway,
 * then light placeholders for Phonics, Picture words, and Listen & tap.
 *
 * Order is path order; `pathIndex` is assigned as `i - length` so indices end at −1.
 */
const STARTER_UNIT_DEFS: readonly StarterUnitDef[] = [
  {
    id: "pre-a1.alphabet.meet-letters",
    stageId: "alphabet",
    stageOrder: 0,
    title: "Pre-A1: Alphabet — Meet the letters",
    teacherNote:
      "Learn letter names A–Z with friendly pictures. Take two gentle passes so names stick.",
    activities: [...alphabetActivities(), ...alphabetActivities()],
    richness: "rich",
  },
  {
    id: "pre-a1.alphabet.letter-pictures",
    stageId: "alphabet",
    stageOrder: 1,
    title: "Pre-A1: Alphabet — Letters and pictures",
    teacherNote: "Match letters to pictures again — celebrate every letter you know.",
    activities: alphabetActivities(),
    richness: "rich",
  },
  {
    id: "pre-a1.alphabet.letters-and-sounds",
    stageId: "alphabet",
    stageOrder: 2,
    title: "Pre-A1: Letters & sounds — First links",
    teacherNote:
      "Gentle letters & sounds bridge (spine.stages.letters-and-sounds). Play with first sound links — not a hard phonics leap.",
    activities: [...alphabetActivities(), ...phonicsActivities()],
    richness: "rich",
  },
  {
    id: "pre-a1.phonics.placeholder",
    stageId: "phonics",
    stageOrder: 0,
    title: "Pre-A1: Phonics",
    teacherNote:
      "Connect sounds to letters and short words. Placeholder — richer content comes later.",
    activities: phonicsActivities(),
    richness: "placeholder",
  },
  {
    id: "pre-a1.picture-words.placeholder",
    stageId: "picture-words",
    stageOrder: 0,
    title: "Pre-A1: Picture words",
    teacherNote: "Match pictures and words. Placeholder — richer content comes later.",
    activities: pictureMatchActivities(),
    richness: "placeholder",
  },
  {
    id: "pre-a1.listen-tap.placeholder",
    stageId: "listen-tap",
    stageOrder: 0,
    title: "Pre-A1: Listen & tap",
    teacherNote: "Listen and tap the right choice. Placeholder — richer content comes later.",
    activities: listenTapActivities(),
    richness: "placeholder",
  },
] as const;

export const PRE_A1_UNIT_COUNT = STARTER_UNIT_DEFS.length;

/** Most-negative path index (first unlocked starter unit). */
export const PRE_A1_FIRST_PATH_INDEX = -PRE_A1_UNIT_COUNT;

export function buildBundledSharedPathStages(now: Date = CATALOG_EPOCH): SharedPathStage[] {
  const titles: Record<PreA1StageId, string> = {
    alphabet: "Alphabet",
    phonics: "Phonics",
    "picture-words": "Picture words",
    "listen-tap": "Listen & tap",
  };
  const order: PreA1StageId[] = ["alphabet", "phonics", "picture-words", "listen-tap"];
  return order.map((id, i) => ({
    id,
    tier: TIER,
    title: titles[id],
    spineSectionKey: PRE_A1_STAGE_SPINE_KEYS[id],
    order: i,
    // Alphabet runway is richly authored at ship; later stages wait on admin ready flags (#128).
    readyForExam: id === "alphabet",
    updatedAt: now,
  }));
}

export function buildBundledSharedPathUnitTemplates(
  now: Date = CATALOG_EPOCH,
): SharedPathUnitTemplate[] {
  return STARTER_UNIT_DEFS.map((def, i) => ({
    id: def.id,
    tier: TIER,
    stageId: def.stageId,
    stageOrder: def.stageOrder,
    pathIndex: i - PRE_A1_UNIT_COUNT,
    title: def.title,
    teacherNote: def.teacherNote,
    activities: def.activities.map((a) => ({ skill: a.skill })),
    richness: def.richness,
    approvalStatus: "approved",
    provenance: "human",
    targetVocab: def.targetVocab ?? [],
    createdAt: now,
    updatedAt: now,
  }));
}

/** Stage id for a path index in the bundled starter (undefined if not pre-A1 catalog). */
export function stageIdForPathIndex(
  pathIndex: number,
  templates: readonly SharedPathUnitTemplate[] = buildBundledSharedPathUnitTemplates(),
): PreA1StageId | undefined {
  return templates.find((t) => t.pathIndex === pathIndex)?.stageId;
}

/** Representative path index for exam-review practice (first unit of the stage). */
export function reviewPathIndexForStage(
  stageId: PreA1StageId,
  templates: readonly SharedPathUnitTemplate[] = buildBundledSharedPathUnitTemplates(),
): number {
  const inStage = templates.filter((t) => t.stageId === stageId);
  const first = inStage.sort((a, b) => a.stageOrder - b.stageOrder)[0];
  if (!first) throw new Error(`No catalog unit for stage ${stageId}`);
  return first.pathIndex;
}

/** Last path index of a stage — used for stage-completion collectibles. */
export function lastPathIndexForStage(
  stageId: PreA1StageId,
  templates: readonly SharedPathUnitTemplate[] = buildBundledSharedPathUnitTemplates(),
): number {
  const inStage = templates.filter((t) => t.stageId === stageId);
  const last = inStage.sort((a, b) => a.stageOrder - b.stageOrder).at(-1);
  if (!last) throw new Error(`No catalog unit for stage ${stageId}`);
  return last.pathIndex;
}

/**
 * Upsert the bundled approved starter into the shared catalog when missing.
 * Idempotent — never overwrites an existing row (admin edits / AI drafts stay put).
 */
export async function ensureSharedPathCatalogSeeded(repo: ContentRepository): Promise<void> {
  const existingStages = await repo.getSharedPathStages();
  if (existingStages.length === 0) {
    for (const stage of buildBundledSharedPathStages()) {
      await repo.putSharedPathStage(stage);
    }
  }

  const existingTemplates = await repo.querySharedPathUnitTemplates();
  const existingIds = new Set(existingTemplates.map((t) => t.id));
  for (const template of buildBundledSharedPathUnitTemplates()) {
    if (existingIds.has(template.id)) continue;
    await repo.putSharedPathUnitTemplate(template);
  }
}

/**
 * Materialize learner `NewUnit` rows from approved catalog templates (pathIndex ascending).
 * Falls back to the bundled starter when the catalog is empty (e.g. thin test fakes).
 */
export function materializePreA1UnitsFromCatalog(
  templates: readonly SharedPathUnitTemplate[],
  now: Date = new Date(),
): NewUnit[] {
  const approved = (templates.length > 0 ? templates : buildBundledSharedPathUnitTemplates())
    .filter((t) => t.tier === "pre-A1" && t.approvalStatus === "approved")
    .slice()
    .sort((a, b) => a.pathIndex - b.pathIndex);

  return approved.map((t, i) => ({
    index: t.pathIndex,
    title: t.title,
    teacherNote: t.teacherNote,
    targetGrammarIds: [],
    targetVocab: t.targetVocab.slice(),
    targetCefr: "A1",
    activities: t.activities.map((a) => ({ skill: a.skill })),
    status: i === 0 ? "available" : "locked",
    bufferStatus: "empty",
    createdAt: now,
  }));
}

const STAGE_PATH_RANK: Record<PreA1StageId, number> = {
  alphabet: 0,
  phonics: 1,
  "picture-words": 2,
  "listen-tap": 3,
};

/** Stable curriculum order: stage spine, then stageOrder, then prior pathIndex. */
export function sortSharedPathTemplatesForPath(
  templates: readonly SharedPathUnitTemplate[],
): SharedPathUnitTemplate[] {
  return templates.slice().sort((a, b) => {
    const stageDiff = STAGE_PATH_RANK[a.stageId] - STAGE_PATH_RANK[b.stageId];
    if (stageDiff !== 0) return stageDiff;
    if (a.stageOrder !== b.stageOrder) return a.stageOrder - b.stageOrder;
    return a.pathIndex - b.pathIndex;
  });
}

/**
 * Assign contiguous negative pathIndex values ending at −1 so learner unlock
 * (`index + 1`) stays valid after densification approvals.
 */
export function withContiguousPreA1PathIndices(
  templates: readonly SharedPathUnitTemplate[],
): SharedPathUnitTemplate[] {
  const sorted = sortSharedPathTemplatesForPath(templates);
  const n = sorted.length;
  return sorted.map((t, i) => ({
    ...t,
    pathIndex: i - n,
  }));
}

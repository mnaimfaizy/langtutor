/**
 * Draft later-stage pre-A1 units into the **shared pending** path cache (ADR 0052, issue #131).
 *
 * Server-only call sites: `app/api/path/shared-draft` and admin server actions. Uses the
 * content pipeline (chat → Zod → corrective retry). Never writes learner `Unit` rows and
 * never invents a private curriculum — drafts land as shared `pending` / `ai-draft` only.
 */
import { NoopContentSink } from "@/lib/content/null-adapters";
import { generateContent } from "@/lib/content/pipeline";
import type { ContentRepository, SharedPathUnitTemplate, UnitActivityRef } from "@/lib/db";
import type { LLMClient } from "@/lib/llm/llm-client";

import {
  listenTapActivities,
  phonicsActivities,
  pictureMatchActivities,
} from "./pre-a1-activities";
import { ensureSharedPathCatalogSeeded } from "./shared-path-catalog";
import {
  AiDraftableStageIdSchema,
  buildSharedUnitDraftMessages,
  SharedUnitDraftSchema,
  type AiDraftableStageId,
  type SharedUnitDraftPayload,
} from "./shared-unit-draft";
import { flattenTargetVocabItems } from "./shared-path-target-vocab";

export const SHARED_UNIT_DRAFT_TOPIC_PREFIX = "shared-path-draft:pre-A1:";

export class SharedUnitDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SharedUnitDraftError";
  }
}

function activitiesForStage(stageId: AiDraftableStageId): UnitActivityRef[] {
  switch (stageId) {
    case "phonics":
      return phonicsActivities();
    case "picture-words":
      return pictureMatchActivities();
    case "listen-tap":
      return listenTapActivities();
  }
}

/** Next stageOrder within the stage (0-based), scanning all approval statuses. */
export function nextStageOrder(
  templates: readonly SharedPathUnitTemplate[],
  stageId: AiDraftableStageId,
): number {
  const inStage = templates.filter((t) => t.stageId === stageId);
  if (inStage.length === 0) return 0;
  return Math.max(...inStage.map((t) => t.stageOrder)) + 1;
}

/**
 * Allocate a unique negative pathIndex. Pending densification slots sit below the
 * current minimum so they never collide with the unique path_index index; admin
 * approve (#129) flips status without remapping in this slice.
 */
export function allocateUniquePathIndex(templates: readonly SharedPathUnitTemplate[]): number {
  if (templates.length === 0) return -1;
  return Math.min(...templates.map((t) => t.pathIndex)) - 1;
}

function newDraftId(stageId: AiDraftableStageId, now: Date): string {
  const stamp = now.getTime().toString(36);
  const entropy = Math.random().toString(36).slice(2, 8);
  return `pre-a1.${stageId}.ai-${stamp}-${entropy}`;
}

export function buildPendingSharedTemplate(opts: {
  stageId: AiDraftableStageId;
  draft: SharedUnitDraftPayload;
  stageOrder: number;
  pathIndex: number;
  now?: Date;
}): SharedPathUnitTemplate {
  const now = opts.now ?? new Date();
  const { words, senses } = flattenTargetVocabItems(opts.draft.targetVocab);
  return {
    id: newDraftId(opts.stageId, now),
    tier: "pre-A1",
    stageId: opts.stageId,
    stageOrder: opts.stageOrder,
    pathIndex: opts.pathIndex,
    title: opts.draft.title,
    teacherNote: opts.draft.teacherNote,
    activities: activitiesForStage(opts.stageId).map((a) => ({ skill: a.skill })),
    richness: "rich",
    approvalStatus: "pending",
    provenance: "ai-draft",
    targetVocab: words,
    ...(Object.keys(senses).length > 0 ? { targetVocabSenses: senses } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generate one densification unit via LLMClient + pipeline and persist it as a
 * shared pending template. Does not touch any learner profile / Unit row.
 */
export async function draftSharedPathUnit(
  repo: ContentRepository,
  llmClient: LLMClient,
  stageId: AiDraftableStageId,
  now: Date = new Date(),
): Promise<SharedPathUnitTemplate> {
  const parsedStage = AiDraftableStageIdSchema.parse(stageId);
  await ensureSharedPathCatalogSeeded(repo);

  const existing = await repo.querySharedPathUnitTemplates({ tier: "pre-A1" });
  const stageOrder = nextStageOrder(existing, parsedStage);
  const pathIndex = allocateUniquePathIndex(existing);

  let draft: SharedUnitDraftPayload;
  try {
    const result = await generateContent(
      {
        messages: buildSharedUnitDraftMessages(parsedStage),
        level: "A1",
        schema: SharedUnitDraftSchema,
        textField: "teacherNote",
        type: "lesson",
        topic: `${SHARED_UNIT_DRAFT_TOPIC_PREFIX}${parsedStage}`,
        skipValidation: true,
      },
      llmClient,
      null,
      new NoopContentSink(),
    );
    draft = result.parsed;
  } catch (err) {
    throw new SharedUnitDraftError(
      err instanceof Error ? err.message : `Shared unit draft failed for ${parsedStage}`,
    );
  }

  const template = buildPendingSharedTemplate({
    stageId: parsedStage,
    draft,
    stageOrder,
    pathIndex,
    now,
  });
  await repo.putSharedPathUnitTemplate(template);
  return template;
}

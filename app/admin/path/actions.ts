"use server";

import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  PRE_A1_STAGE_IDS,
  type PreA1StageId,
  type SharedPathStage,
  type SharedPathUnitTemplate,
} from "@/lib/db";
import { getServerContentRepository } from "@/lib/db/server";
import { getLLMClient } from "@/lib/llm/server";
import {
  approveSharedPathUnitTemplate,
  rejectSharedPathUnitTemplate,
  setSharedPathStageReadyForExam,
  SharedPathAdminError,
} from "@/lib/path/shared-path-admin";
import {
  fillThinSharedPathStages,
  type SharedPathBackgroundFillResult,
} from "@/lib/path/shared-path-background-fill";
import { ensureSharedPathCatalogSeeded } from "@/lib/path/shared-path-catalog";
import {
  assessSharedPathVocabMedia,
  type SharedPathWordMediaStatus,
} from "@/lib/path/shared-path-media-readiness";
import { AiDraftableStageIdSchema, type AiDraftableStageId } from "@/lib/path/shared-unit-draft";
import { draftSharedPathUnit, SharedUnitDraftError } from "@/lib/path/shared-unit-drafter";

const TemplateIdSchema = z.string().trim().min(1).max(200);
const StageIdSchema = z.enum(PRE_A1_STAGE_IDS);
const ReadySchema = z.object({
  stageId: StageIdSchema,
  readyForExam: z.boolean(),
});

/** Template plus per-word image/audio readiness for admin review (slice 1). */
export type SharedPathUnitTemplateReview = SharedPathUnitTemplate & {
  mediaByWord: SharedPathWordMediaStatus[];
};

export type SharedPathAdminSnapshot = {
  pending: SharedPathUnitTemplateReview[];
  approved: SharedPathUnitTemplateReview[];
  rejected: SharedPathUnitTemplateReview[];
  stages: SharedPathStage[];
};

async function withMediaReadiness(
  repo: Awaited<ReturnType<typeof getServerContentRepository>>,
  templates: SharedPathUnitTemplate[],
): Promise<SharedPathUnitTemplateReview[]> {
  return Promise.all(
    templates.map(async (template) => ({
      ...template,
      mediaByWord: await assessSharedPathVocabMedia(repo, template.targetVocab, {
        senses: template.targetVocabSenses,
      }),
    })),
  );
}

/** Ensure starter rows exist, then return pending / approved / rejected + stages. */
export async function listSharedPathCatalog(): Promise<SharedPathAdminSnapshot> {
  await requireAdmin();
  const repo = await getServerContentRepository();
  await ensureSharedPathCatalogSeeded(repo);

  const [templates, stages] = await Promise.all([
    repo.querySharedPathUnitTemplates({ tier: "pre-A1" }),
    repo.getSharedPathStages(),
  ]);

  const [pending, approved, rejected] = await Promise.all([
    withMediaReadiness(
      repo,
      templates.filter((t) => t.approvalStatus === "pending"),
    ),
    withMediaReadiness(
      repo,
      templates.filter((t) => t.approvalStatus === "approved"),
    ),
    withMediaReadiness(
      repo,
      templates.filter((t) => t.approvalStatus === "rejected"),
    ),
  ]);

  return {
    pending,
    approved,
    rejected,
    stages: stages.slice().sort((a, b) => a.order - b.order),
  };
}

export async function approveSharedPathDraft(id: string): Promise<SharedPathUnitTemplate> {
  await requireAdmin();
  const parsed = TemplateIdSchema.parse(id);
  const repo = await getServerContentRepository();
  try {
    return await approveSharedPathUnitTemplate(repo, parsed);
  } catch (err) {
    if (err instanceof SharedPathAdminError) throw new Error(err.message);
    throw err;
  }
}

export async function rejectSharedPathDraft(id: string): Promise<SharedPathUnitTemplate> {
  await requireAdmin();
  const parsed = TemplateIdSchema.parse(id);
  const repo = await getServerContentRepository();
  try {
    return await rejectSharedPathUnitTemplate(repo, parsed);
  } catch (err) {
    if (err instanceof SharedPathAdminError) throw new Error(err.message);
    throw err;
  }
}

export async function markSharedPathStageReady(
  stageId: PreA1StageId,
  readyForExam: boolean,
): Promise<SharedPathStage> {
  await requireAdmin();
  const parsed = ReadySchema.parse({ stageId, readyForExam });
  const repo = await getServerContentRepository();
  try {
    return await setSharedPathStageReadyForExam(repo, parsed.stageId, parsed.readyForExam);
  } catch (err) {
    if (err instanceof SharedPathAdminError) throw new Error(err.message);
    throw err;
  }
}

/** Admin-driven AI densification into shared pending (issue #131). */
export async function draftSharedPathStageUnit(
  stageId: AiDraftableStageId,
): Promise<SharedPathUnitTemplate> {
  await requireAdmin();
  const parsed = AiDraftableStageIdSchema.parse(stageId);
  const [repo, llmClient] = await Promise.all([getServerContentRepository(), getLLMClient()]);
  try {
    return await draftSharedPathUnit(repo, llmClient, parsed);
  } catch (err) {
    if (err instanceof SharedUnitDraftError) throw new Error(err.message);
    throw err;
  }
}

/** Background fill — shared pending only; never per-user curricula (issue #131). */
export async function fillThinSharedPathStagesAction(): Promise<SharedPathBackgroundFillResult> {
  await requireAdmin();
  const [repo, llmClient] = await Promise.all([getServerContentRepository(), getLLMClient()]);
  return fillThinSharedPathStages(repo, llmClient);
}

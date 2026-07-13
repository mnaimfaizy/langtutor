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
import {
  approveSharedPathUnitTemplate,
  rejectSharedPathUnitTemplate,
  setSharedPathStageReadyForExam,
  SharedPathAdminError,
} from "@/lib/path/shared-path-admin";
import { ensureSharedPathCatalogSeeded } from "@/lib/path/shared-path-catalog";

const TemplateIdSchema = z.string().trim().min(1).max(200);
const StageIdSchema = z.enum(PRE_A1_STAGE_IDS);
const ReadySchema = z.object({
  stageId: StageIdSchema,
  readyForExam: z.boolean(),
});

export type SharedPathAdminSnapshot = {
  pending: SharedPathUnitTemplate[];
  approved: SharedPathUnitTemplate[];
  rejected: SharedPathUnitTemplate[];
  stages: SharedPathStage[];
};

/** Ensure starter rows exist, then return pending / approved / rejected + stages. */
export async function listSharedPathCatalog(): Promise<SharedPathAdminSnapshot> {
  await requireAdmin();
  const repo = await getServerContentRepository();
  await ensureSharedPathCatalogSeeded(repo);

  const [templates, stages] = await Promise.all([
    repo.querySharedPathUnitTemplates({ tier: "pre-A1" }),
    repo.getSharedPathStages(),
  ]);

  return {
    pending: templates.filter((t) => t.approvalStatus === "pending"),
    approved: templates.filter((t) => t.approvalStatus === "approved"),
    rejected: templates.filter((t) => t.approvalStatus === "rejected"),
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

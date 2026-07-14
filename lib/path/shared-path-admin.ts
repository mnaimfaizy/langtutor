/**
 * Shared path catalog admin mutations (ADR 0051 / 0055, issue #129).
 *
 * One review serves every learner — approve / reject / ready-for-exam write the
 * shared cache only. No per-profile approval queue.
 */
import type {
  ContentRepository,
  PreA1StageId,
  SharedPathStage,
  SharedPathUnitTemplate,
} from "@/lib/db";

import { withContiguousPreA1PathIndices } from "./shared-path-catalog";

export class SharedPathAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SharedPathAdminError";
  }
}

async function requireTemplate(
  repo: ContentRepository,
  id: string,
): Promise<SharedPathUnitTemplate> {
  const rows = await repo.querySharedPathUnitTemplates();
  const template = rows.find((row) => row.id === id);
  if (!template) {
    throw new SharedPathAdminError(`Shared path unit template not found: ${id}`);
  }
  return template;
}

async function requireStage(
  repo: ContentRepository,
  stageId: PreA1StageId,
): Promise<SharedPathStage> {
  const stages = await repo.getSharedPathStages();
  const stage = stages.find((row) => row.id === stageId);
  if (!stage) {
    throw new SharedPathAdminError(`Shared path stage not found: ${stageId}`);
  }
  return stage;
}

/** Temp pathIndex band while rewriting contiguous indices (unique path_index constraint). */
const PATH_INDEX_REWRITE_BASE = -1_000_000;

/**
 * Persist approved templates with contiguous pathIndex values. Two-phase write avoids
 * colliding with the shared `path_index` unique index mid-update.
 */
export async function persistReindexedApprovedTemplates(
  repo: ContentRepository,
  approved: readonly SharedPathUnitTemplate[],
): Promise<SharedPathUnitTemplate[]> {
  const reindexed = withContiguousPreA1PathIndices(approved);
  for (let i = 0; i < reindexed.length; i++) {
    const t = reindexed[i]!;
    await repo.putSharedPathUnitTemplate({
      ...t,
      pathIndex: PATH_INDEX_REWRITE_BASE - i,
    });
  }
  for (const t of reindexed) {
    await repo.putSharedPathUnitTemplate(t);
  }
  return reindexed;
}

/** Promote a pending (or rejected) draft into the approved shared catalog. */
export async function approveSharedPathUnitTemplate(
  repo: ContentRepository,
  id: string,
  now: Date = new Date(),
): Promise<SharedPathUnitTemplate> {
  const template = await requireTemplate(repo, id);
  const alreadyApproved = await repo.querySharedPathUnitTemplates({
    approvalStatus: "approved",
  });
  const nextApproved = [
    ...alreadyApproved.filter((row) => row.id !== template.id),
    {
      ...template,
      approvalStatus: "approved" as const,
      updatedAt: now,
    },
  ];
  const reindexed = await persistReindexedApprovedTemplates(repo, nextApproved);
  const saved = reindexed.find((row) => row.id === id);
  if (!saved) {
    throw new SharedPathAdminError(`Approved template missing after reindex: ${id}`);
  }
  return saved;
}

/**
 * Reject a draft so it stays off all learners. The row remains for admin
 * transparency; materialization only consumes `approved` templates.
 */
export async function rejectSharedPathUnitTemplate(
  repo: ContentRepository,
  id: string,
  now: Date = new Date(),
): Promise<SharedPathUnitTemplate> {
  const template = await requireTemplate(repo, id);
  const next: SharedPathUnitTemplate = {
    ...template,
    approvalStatus: "rejected",
    updatedAt: now,
  };
  await repo.putSharedPathUnitTemplate(next);
  return next;
}

/** Admin enrichment bar (ADR 0055) — one flag serves every learner. */
export async function setSharedPathStageReadyForExam(
  repo: ContentRepository,
  stageId: PreA1StageId,
  readyForExam: boolean,
  now: Date = new Date(),
): Promise<SharedPathStage> {
  const stage = await requireStage(repo, stageId);
  const next: SharedPathStage = {
    ...stage,
    readyForExam,
    updatedAt: now,
  };
  await repo.putSharedPathStage(next);
  return next;
}

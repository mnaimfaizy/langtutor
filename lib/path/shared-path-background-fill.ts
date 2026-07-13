/**
 * Optional background fill for thin later-stage pre-A1 stages (ADR 0052, issue #131).
 *
 * Only enqueues **shared** pending / ai-draft templates — never per-user curricula or
 * learner Unit rows. Alphabet is never drafted here (human-authored runway).
 */
import type { ContentRepository, SharedPathUnitTemplate } from "@/lib/db";
import type { LLMClient } from "@/lib/llm/llm-client";

import { ensureSharedPathCatalogSeeded } from "./shared-path-catalog";
import { AI_DRAFTABLE_STAGE_IDS, type AiDraftableStageId } from "./shared-unit-draft";
import { draftSharedPathUnit, SharedUnitDraftError } from "./shared-unit-drafter";

/** Cap drafts per background-fill pass so a single request stays bounded. */
export const SHARED_PATH_FILL_MAX_DRAFTS_PER_PASS = 3;

/**
 * A later stage needs densification when it has no approved rich units yet and
 * nothing already waiting in the shared pending queue.
 */
export function stageNeedsSharedDensification(
  templates: readonly SharedPathUnitTemplate[],
  stageId: AiDraftableStageId,
): boolean {
  const inStage = templates.filter((t) => t.stageId === stageId);
  if (inStage.some((t) => t.approvalStatus === "pending")) return false;
  return !inStage.some((t) => t.approvalStatus === "approved" && t.richness === "rich");
}

export type SharedPathBackgroundFillResult = {
  drafted: SharedPathUnitTemplate[];
  skippedStages: AiDraftableStageId[];
  failures: Array<{ stageId: AiDraftableStageId; message: string }>;
};

/**
 * Draft shared pending units for thin later stages (Phonics / Picture words / Listen & tap).
 * Failures on one stage are recorded and skipped so the pass never invents private paths.
 */
export async function fillThinSharedPathStages(
  repo: ContentRepository,
  llmClient: LLMClient,
  opts: { maxDrafts?: number; now?: Date } = {},
): Promise<SharedPathBackgroundFillResult> {
  const maxDrafts = opts.maxDrafts ?? SHARED_PATH_FILL_MAX_DRAFTS_PER_PASS;
  const now = opts.now ?? new Date();

  await ensureSharedPathCatalogSeeded(repo);
  let templates = await repo.querySharedPathUnitTemplates({ tier: "pre-A1" });

  const drafted: SharedPathUnitTemplate[] = [];
  const skippedStages: AiDraftableStageId[] = [];
  const failures: SharedPathBackgroundFillResult["failures"] = [];

  for (const stageId of AI_DRAFTABLE_STAGE_IDS) {
    if (drafted.length >= maxDrafts) {
      skippedStages.push(stageId);
      continue;
    }
    if (!stageNeedsSharedDensification(templates, stageId)) {
      skippedStages.push(stageId);
      continue;
    }

    try {
      const template = await draftSharedPathUnit(repo, llmClient, stageId, now);
      drafted.push(template);
      // Refresh so the next stage sees the new pending row / pathIndex.
      templates = await repo.querySharedPathUnitTemplates({ tier: "pre-A1" });
    } catch (err) {
      const message =
        err instanceof SharedUnitDraftError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      console.error(`[path/shared-path-background-fill] ${stageId}`, err);
      failures.push({ stageId, message });
    }
  }

  return { drafted, skippedStages, failures };
}

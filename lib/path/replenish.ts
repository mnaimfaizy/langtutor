/**
 * Path-buffer replenishment orchestration (ADR 0015, issue #61; exam buffer ADR 0037 / #118;
 * shared pre-A1 catalog ADR 0051 / issue #126).
 *
 * Plans any unplanned **A1+** units in the buffer window (extending issue #58's
 * `/api/path/plan`) and generates missing activity content for planned-but-not-yet-buffered
 * units (extending issue #59/#60's generate-and-cache pattern), up to `PATH_BUFFER_DEPTH`
 * future units. Also pre-buffers the next pre-A1 chapter exam when the gate is pending and
 * drains deferred teacher reports when the provider is reachable again.
 *
 * Never invents or appends private pre-A1 path units — progression consumes the shared
 * catalog ladder; this pass only fills content **inside** approved templates and routine
 * exam buffers.
 *
 * Called on two triggers (both best-effort, both silent): authed session start
 * (`app/home/learning-path.tsx`) and unit completion (`lib/path/unit-player.ts`). Never throws
 * and never awaited by the caller's navigation/render path — a provider outage mid-pass simply
 * leaves the remaining work for the next trigger, exactly like the existing teacher-planner
 * pass (`lib/path/teacher-planner.ts`) already does for planning alone.
 */
import type { ContentRepository, Unit } from "@/lib/db";

import { generateActivityContent } from "./activity-content";
import {
  computeUnitBufferStatus,
  decideReplenishment,
  isActivityReady,
  PATH_BUFFER_DEPTH,
} from "./buffer";
import {
  PRE_A1_CHAPTER_TIER,
  arePreA1StagesReadyForExam,
  resolveChapterGateStatus,
} from "./chapter-gate";
import { shouldBufferPreA1Exam } from "./exam/buffer";
import {
  drainDeferredPreA1TeacherReports,
  hasBufferedPreA1Exam,
  replenishPreA1ExamBuffer,
  type FetchExamFillFn,
  type FetchTeacherReportFn,
} from "./exam/buffer-store";
import type { PlannedUnit } from "./teacher-planner";

/** Injectable so tests can simulate provider success/failure without a real network call. */
export type GenerateActivityContentFn = typeof generateActivityContent;

/**
 * Asks the server to plan any unplanned future units and applies whatever it returns to the
 * repository. Silent no-op on any failure — an unreachable provider must never surface an
 * error here. Persisting the (already Zod-validated) plan is a plain repository write, not a
 * Mac call — only `POST /api/path/plan` itself talks to the Mac (hard rule 1).
 */
async function planUnplannedUnits(repo: ContentRepository): Promise<void> {
  try {
    const res = await fetch("/api/path/plan", { method: "POST" });
    if (!res.ok) return;

    const data = (await res.json()) as { plans?: PlannedUnit[] };
    for (const plan of data.plans ?? []) {
      await repo.updateUnit(plan.unitId, {
        title: plan.title,
        teacherNote: plan.teacherNote,
        targetVocab: plan.targetVocab,
      });
    }
  } catch {
    // Provider unreachable or malformed response — leave backbone placeholders in place.
  }
}

/**
 * Generates @unit's remaining not-yet-ready activity slots one at a time, persisting each
 * success immediately so a later failure doesn't lose earlier progress. Stops at the first
 * failure and reports the provider as unreachable so the caller skips the rest of this pass
 * (retrying every remaining unit's every activity against an already-unreachable provider
 * would just be several more guaranteed-failing network round trips).
 */
async function bufferUnitContent(
  repo: ContentRepository,
  unit: Unit,
  generate: GenerateActivityContentFn,
): Promise<boolean> {
  const activities = unit.activities.slice();
  let providerReachable = true;
  let changed = false;

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i]!;
    if (isActivityReady(activity)) continue;

    try {
      const contentId = await generate(repo, unit, activity.skill);
      activities[i] = { ...activity, contentId };
      changed = true;
    } catch {
      providerReachable = false;
      break;
    }
  }

  if (changed) {
    await repo.updateUnit(unit.id, {
      activities,
      bufferStatus: computeUnitBufferStatus({ ...unit, activities }),
    });
  }

  return providerReachable;
}

/**
 * Runs one best-effort path-buffer replenishment pass: plan A1+ placeholders when needed,
 * then generate content for up to @depth future units, then (when needed) pre-buffer the
 * pre-A1 chapter exam and drain any deferred teacher reports. Always resolves — never
 * throws, never rejects — so callers can fire it without awaiting (unit completion) or await
 * it in a background effect that already rendered (session start) without either path ever
 * blocking or erroring the UI.
 *
 * @param onAfterPlan optional hook fired after planning is persisted (or skipped) and before
 *   content generation. Session-start UI uses this to re-render teacher titles/notes
 *   immediately — content generation (and any slow embeddings) must not gate the planned
 *   metadata.
 */
export async function replenishPathBuffer(
  repo: ContentRepository,
  depth: number = PATH_BUFFER_DEPTH,
  generate: GenerateActivityContentFn = generateActivityContent,
  onAfterPlan?: () => void | Promise<void>,
  fetchExamFill: FetchExamFillFn | undefined = undefined,
  fetchTeacherReport: FetchTeacherReportFn | undefined = undefined,
): Promise<void> {
  try {
    const beforePlan = await repo.getUnits();
    const { toPlan } = decideReplenishment(beforePlan, depth);
    // Skip the plan API entirely when the buffer window has no A1+ units needing a teacher
    // plan (e.g. mid-pre-A1 — catalog units must not trigger per-learner invent calls).
    if (toPlan.length > 0) {
      await planUnplannedUnits(repo);
    }
    await onAfterPlan?.();

    const units = toPlan.length > 0 ? await repo.getUnits() : beforePlan;
    const { toGenerateContent } = decideReplenishment(units, depth);

    let providerReachable = true;
    for (const unit of toGenerateContent) {
      providerReachable = await bufferUnitContent(repo, unit, generate);
      if (!providerReachable) break;
    }

    // Exam buffer + deferred reports only when unit content buffering did not already
    // prove the provider unreachable (avoid guaranteed-failing round trips).
    if (providerReachable) {
      const gate = await repo.getChapterGate(PRE_A1_CHAPTER_TIER);
      const gateStatus = resolveChapterGateStatus(gate);
      const hasBuffer = await hasBufferedPreA1Exam(repo);
      const stagesReadyForExam = arePreA1StagesReadyForExam(await repo.getSharedPathStages());
      const needsExamBuffer = shouldBufferPreA1Exam({
        units: await repo.getUnits(),
        gateStatus,
        hasBufferedExam: hasBuffer,
        stagesReadyForExam,
      });
      providerReachable = fetchExamFill
        ? await replenishPreA1ExamBuffer(repo, needsExamBuffer, fetchExamFill)
        : await replenishPreA1ExamBuffer(repo, needsExamBuffer);
    }

    if (providerReachable) {
      if (fetchTeacherReport) {
        await drainDeferredPreA1TeacherReports(repo, fetchTeacherReport);
      } else {
        await drainDeferredPreA1TeacherReports(repo);
      }
    }
  } catch {
    // Replenishment is best-effort only — a failure here must never surface to the caller.
  }
}

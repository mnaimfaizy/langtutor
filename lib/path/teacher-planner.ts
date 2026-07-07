/**
 * LLM-teacher planning orchestration (ADR 0015, issue #58).
 *
 * Consumes the existing content pipeline (`lib/content/pipeline.ts`): chat → Zod-parse the
 * plan → corrective retry on invalid output. Plan text is teacher-voice metadata (a title,
 * a note, a vocab list) rather than CEFR-gated prose, so validation is schema-only —
 * `skipValidation: true`, same convention as `lib/content/prompt.ts` (writing prompts).
 *
 * Only ever called server-side (hard rule 1) — see `app/api/path/plan/route.ts`, the sole
 * caller. This module has no `server-only` import itself because the safety comes from that
 * call-site discipline, the same as `lib/content/pipeline.ts`.
 *
 * The weakness engine (`lib/diagnostics/weakness.ts`) is a producer this module only
 * consumes — it never recomputes or writes weaknesses.
 */
import { lookupConstruction } from "@/lib/content/grammar-map";
import { NoopContentSink } from "@/lib/content/null-adapters";
import { generateContent } from "@/lib/content/pipeline";
import { DEFAULT_EXPERIENCE_MODE, type Profile, type Unit, type Weakness } from "@/lib/db";
import type { LLMClient } from "@/lib/llm/llm-client";

import { buildTeacherPlanMessages, UnitPlanSchema } from "./teacher-plan";

/** Cap on LLM calls per planning pass — keeps a single home-load request bounded. */
export const UNITS_TO_PLAN_PER_PASS = 3;

/** A validated plan for one unit, ready to be persisted via `ContentRepository.updateUnit`. */
export interface PlannedUnit {
  unitId: number;
  title: string;
  teacherNote: string;
  targetVocab: string[];
}

/** Future (not completed, not in-progress), backbone-seeded units with no plan yet. */
function unplannedFutureUnits(units: Unit[]): Unit[] {
  return units
    .filter(
      (u) => (u.status === "locked" || u.status === "available") && u.targetVocab.length === 0,
    )
    .sort((a, b) => a.index - b.index)
    .slice(0, UNITS_TO_PLAN_PER_PASS);
}

/**
 * Plans up to {@link UNITS_TO_PLAN_PER_PASS} unplanned future units. Each unit is planned
 * independently: a corrective-retry failure or provider outage on one unit is caught and
 * skipped (leaving its backbone placeholder untouched) so it never blocks the rest of the
 * pass or surfaces an error to the caller — the whole point is "no user-facing error".
 */
export async function planFutureUnits(
  units: Unit[],
  profile: Profile,
  weaknesses: Weakness[],
  llmClient: LLMClient,
): Promise<PlannedUnit[]> {
  if (!profile.cefrLevel) return [];
  const experienceMode = profile.experienceMode ?? DEFAULT_EXPERIENCE_MODE;

  const planned: PlannedUnit[] = [];
  for (const unit of unplannedFutureUnits(units)) {
    const construction = lookupConstruction(unit.targetGrammarIds[0] ?? "");
    if (!construction) continue; // no known backbone anchor to plan against (e.g. a future pre-A1 unit)

    try {
      const result = await generateContent(
        {
          messages: buildTeacherPlanMessages({
            experienceMode,
            cefrLevel: unit.targetCefr,
            goals: profile.goals,
            construction,
            weaknesses,
          }),
          level: unit.targetCefr,
          schema: UnitPlanSchema,
          textField: "teacherNote",
          type: "lesson",
          topic: construction.id,
          skipValidation: true,
        },
        llmClient,
        null,
        new NoopContentSink(),
      );
      planned.push({ unitId: unit.id, ...result.parsed });
    } catch (err) {
      console.error(`[path/teacher-planner] failed to plan unit ${unit.id}`, err);
    }
  }
  return planned;
}

/**
 * Learning-path seeding orchestration (ADR 0015, issue #57). Mirrors the
 * `lib/content/seed.ts` pattern: idempotent, safe to call on every authed-home visit,
 * and mutex-guarded against concurrent callers seeding twice.
 */
import type { Cefr, ContentRepository } from "@/lib/db";

import { seedBackbonePath } from "./backbone-planner";

let _seedingPromise: Promise<void> | null = null;

/**
 * Seeds @repo's learning path from the backbone if the learner has no units yet.
 * Deterministic and offline — no LLM/network call.
 */
export async function loadPathIfEmpty(repo: ContentRepository, anchorLevel: Cefr): Promise<void> {
  if (_seedingPromise) {
    await _seedingPromise;
    return;
  }
  _seedingPromise = _doSeed(repo, anchorLevel).finally(() => {
    _seedingPromise = null;
  });
  await _seedingPromise;
}

async function _doSeed(repo: ContentRepository, anchorLevel: Cefr): Promise<void> {
  const existing = await repo.getUnits();
  if (existing.length > 0) return;

  for (const unit of seedBackbonePath(anchorLevel)) {
    await repo.addUnit(unit);
  }
}

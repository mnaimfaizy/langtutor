/**
 * Learning-path seeding orchestration (ADR 0015, issue #57; pre-A1 tier issue #66). Mirrors
 * the `lib/content/seed.ts` pattern: idempotent, safe to call on every authed-home visit,
 * and mutex-guarded against concurrent callers seeding twice.
 */
import type { Cefr, ContentRepository, Profile } from "@/lib/db";

import { seedBackbonePath } from "./backbone-planner";
import { hasReachedFirstA1Unit, seedPreA1Units, shouldSeedPreA1 } from "./pre-a1";

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

/**
 * Ensures pre-A1 units match the learner's profile: seeds negative-index placeholders when
 * eligible, removes them when opted out, and never touches A1+ units. Skips seeding once
 * unit 0 has unlocked — the natural handoff into A1.
 */
export async function syncPreA1Units(repo: ContentRepository, profile: Profile): Promise<void> {
  const anchorLevel = profile.cefrLevel ?? "A1";
  const units = await repo.getUnits();
  if (hasReachedFirstA1Unit(units)) return;

  const wantPreA1 = shouldSeedPreA1(profile, anchorLevel);
  const existingPreA1 = units.filter((u) => u.index < 0);

  if (wantPreA1 && existingPreA1.length === 0) {
    for (const unit of seedPreA1Units()) {
      await repo.addUnit(unit);
    }
    const unit0 = (await repo.getUnits()).find((u) => u.index === 0);
    if (unit0?.status === "available") {
      await repo.updateUnit(unit0.id, { status: "locked" });
    }
    return;
  }

  if (!wantPreA1 && existingPreA1.length > 0) {
    for (const unit of existingPreA1) {
      await repo.deleteUnit(unit.id);
    }
    const unit0 = (await repo.getUnits()).find((u) => u.index === 0);
    if (unit0?.status === "locked") {
      await repo.updateUnit(unit0.id, { status: "available" });
    }
  }
}

/**
 * Backbone seed (when empty) plus pre-A1 sync — the home path's single entry point.
 */
export async function ensurePath(repo: ContentRepository, profile: Profile): Promise<void> {
  const anchorLevel = profile.cefrLevel ?? "A1";
  await loadPathIfEmpty(repo, anchorLevel);
  await syncPreA1Units(repo, profile);
}

/**
 * Learning-path seeding orchestration (ADR 0015, issue #57; pre-A1 tier issues #66 / #125).
 * Mirrors the `lib/content/seed.ts` pattern: idempotent, safe to call on every authed-home
 * visit, and mutex-guarded against concurrent callers seeding twice. Pre-A1 units materialize
 * from the shared path catalog — never from a per-signup LLM invent.
 */
import type { Cefr, ContentRepository, Profile } from "@/lib/db";

import { seedBackbonePath } from "./backbone-planner";
import { migrateLegacyPreA1Units } from "./migrate-legacy-pre-a1";
import { hasReachedFirstA1Unit, shouldSeedPreA1 } from "./pre-a1";
import { reconcileLearnerPreA1WithCatalog } from "./reconcile-learner-pre-a1";
import {
  ensureSharedPathCatalogSeeded,
  materializePreA1UnitsFromCatalog,
} from "./shared-path-catalog";

let _seedingPromise: Promise<void> | null = null;
let _preA1SyncPromise: Promise<void> | null = null;

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
  if (_preA1SyncPromise) {
    await _preA1SyncPromise;
    return;
  }

  _preA1SyncPromise = _doSyncPreA1Units(repo, profile).finally(() => {
    _preA1SyncPromise = null;
  });
  await _preA1SyncPromise;
}

async function _doSyncPreA1Units(repo: ContentRepository, profile: Profile): Promise<void> {
  const anchorLevel = profile.cefrLevel ?? "A1";
  // Legacy four-unit profiles must migrate before the A1-handoff early-return (ADR 0056).
  await migrateLegacyPreA1Units(repo);
  const units = await repo.getUnits();
  if (hasReachedFirstA1Unit(units)) return;

  const wantPreA1 = shouldSeedPreA1(profile, anchorLevel);
  const existingPreA1 = units.filter((u) => u.index < 0);

  if (wantPreA1 && existingPreA1.length === 0) {
    await ensureSharedPathCatalogSeeded(repo);
    const templates = await repo.querySharedPathUnitTemplates({
      tier: "pre-A1",
      approvalStatus: "approved",
    });
    for (const unit of materializePreA1UnitsFromCatalog(templates)) {
      await repo.addUnit(unit);
    }
    const unit0 = (await repo.getUnits()).find((u) => u.index === 0);
    if (unit0?.status === "available") {
      await repo.updateUnit(unit0.id, { status: "locked" });
    }
    return;
  }

  if (wantPreA1 && existingPreA1.length > 0) {
    await ensureSharedPathCatalogSeeded(repo);
    const templates = await repo.querySharedPathUnitTemplates({
      tier: "pre-A1",
      approvalStatus: "approved",
    });
    await reconcileLearnerPreA1WithCatalog(repo, templates);
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

/**
 * Phase 8.2 — Backup & Restore e2e.
 *
 * Verifies the settings-page UI: export downloads a valid JSON backup file,
 * and import restores data from that file.
 */

import { readFile } from "node:fs/promises";

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword — see onboarding.spec.ts

/** Completes onboarding, anchoring the path at A1, and waits for the seed (due cards). */
async function setupWithSeed(page: Page) {
  await page.goto("/onboarding");
  await page.getByTestId("quiz-start-btn").click();
  await expect(page.getByTestId("quiz-quizzing")).toBeVisible();
  for (let i = 0; i < BATCH_SIZE; i++) {
    await page.getByTestId("btn-unknown").click();
  }
  await page.getByTestId("btn-save-level").click();
  await expect(page.getByTestId("goals-picker")).toBeVisible();
  await page.getByTestId("goal-btn-general").click();
  await page.getByTestId("btn-save-goals").click();
  await page.waitForURL("/home");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
}

/** Rates every due card as "good" until the review session reaches its summary. */
async function rateAllDueCardsGood(page: Page): Promise<void> {
  const summary = page.getByTestId("review-summary");
  const reveal = page.getByTestId("btn-reveal");
  const rateGood = page.getByTestId("btn-rate-good");
  const progress = page.getByTestId("review-progress");

  for (let i = 0; i < 40; i++) {
    if (await summary.isVisible()) return;
    await expect(reveal.or(summary)).toBeVisible({ timeout: 10_000 });
    if (await summary.isVisible()) return;

    const text = (await progress.textContent()) ?? "";
    const [posStr, totalStr] = text.split("/").map((s) => s.trim());
    const isLast = Number(posStr) >= Number(totalStr);

    await reveal.click();
    await expect(rateGood).toBeVisible({ timeout: 10_000 });
    await rateGood.click();

    if (isLast) {
      await expect(summary).toBeVisible({ timeout: 10_000 });
      return;
    }
  }
}

test("backup: export downloads a valid JSON file and shows success banner", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });

  await page.goto("/settings");
  await expect(page.getByTestId("backup-section")).toBeVisible({ timeout: 5_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("btn-export-backup").click();
  const download = await downloadPromise;

  // Filename matches lang-tutor-backup-YYYY-MM-DD.json
  expect(download.suggestedFilename()).toMatch(/^lang-tutor-backup-\d{4}-\d{2}-\d{2}\.json$/);

  // File content is valid BackupData
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const raw = await readFile(filePath!, "utf-8");
  const json = JSON.parse(raw) as unknown;
  expect(json).toMatchObject({
    version: 1,
    exportedAt: expect.any(String),
    tables: expect.objectContaining({
      profile: expect.any(Array),
      cards: expect.any(Array),
      content: expect.any(Array),
      errorEvents: expect.any(Array),
      weakness: expect.any(Array),
      gamification: expect.any(Array),
      lexiconCache: expect.any(Array),
    }),
  });

  // Success banner appears
  await expect(page.getByTestId("backup-banner")).toHaveText("Backup downloaded.", {
    timeout: 3_000,
  });
});

test("backup: import restores data and shows success banner", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });

  await page.goto("/settings");
  await expect(page.getByTestId("backup-section")).toBeVisible({ timeout: 5_000 });

  // Export first to obtain a valid backup file
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("btn-export-backup").click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  // Clear the success banner before testing import
  await page.goto("/settings");
  await expect(page.getByTestId("backup-section")).toBeVisible({ timeout: 5_000 });

  // Trigger the hidden file input directly
  await page.locator('[data-testid="input-import-file"]').setInputFiles(backupPath!);

  // Import success banner appears
  await expect(page.getByTestId("backup-banner")).toContainText("Backup restored", {
    timeout: 10_000,
  });
});

// Issue #64 — QA gate: backup/restore must round-trip the learning path (units table, added by
// issue #57) exactly like every other table, not just an empty/never-started path. Exports a
// path with a unit already in progress, wipes it via a reset, and imports the backup back —
// the restored unit must keep its id, status, and per-activity completion, and the path's lock
// state (unit 1 still locked behind it) must be unchanged.
test("backup: export/import round-trips a mid-progress learning path", async ({
  page,
  request,
}) => {
  await request.post("/api/test/reset");
  await setupWithSeed(page);

  const firstUnit = page.getByTestId("unit-0");
  await expect(firstUnit).toBeVisible();
  const unitId = await firstUnit.getAttribute("data-unit-id");
  expect(unitId).toBeTruthy();

  await firstUnit.click();
  await page.waitForURL(`/path/${unitId}`);
  await page.getByTestId("btn-start-activity-0").click();
  await page.waitForURL(`/review?unit=${unitId}&activity=0`);
  await rateAllDueCardsGood(page);
  await expect(page.getByTestId("review-summary")).toBeVisible();
  await page.getByTestId("btn-back-to-unit-or-home").click();
  await page.waitForURL(`/path/${unitId}`);

  await page.goto("/home");
  await expect(firstUnit).toHaveAttribute("data-status", "in-progress");

  await page.goto("/settings");
  await expect(page.getByTestId("backup-section")).toBeVisible({ timeout: 5_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("btn-export-backup").click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  // Wipe the path (and everything else) via the same reset every other test uses, then restore
  // from the backup taken above.
  await request.post("/api/test/reset");
  await page.goto("/settings");
  await expect(page.getByTestId("backup-section")).toBeVisible({ timeout: 5_000 });
  await page.locator('[data-testid="input-import-file"]').setInputFiles(backupPath!);
  await expect(page.getByTestId("backup-banner")).toContainText("Backup restored", {
    timeout: 10_000,
  });

  await page.goto("/home");
  await expect(firstUnit).toHaveAttribute("data-unit-id", unitId!);
  await expect(firstUnit).toHaveAttribute("data-status", "in-progress");
  await expect(page.getByTestId("unit-1")).toHaveAttribute("data-status", "locked");

  // The restored unit remembers exactly which activity is done, not just its overall status.
  await firstUnit.click();
  await page.waitForURL(`/path/${unitId}`);
  await expect(page.getByTestId("unit-activity-0")).toContainText("Done");
  await expect(page.getByTestId("unit-activity-1")).toContainText("Up next");
});

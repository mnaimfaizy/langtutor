/**
 * Phase 8.2 — Backup & Restore e2e.
 *
 * Verifies the settings-page UI: export downloads a valid JSON backup file,
 * and import restores data from that file.
 */

import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

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

import { expect, test } from "@playwright/test";

/**
 * Phase 1.8 + 4.1 acceptance test — offline first-run seed.
 *
 * Each Playwright test runs in a fresh browser context (empty IndexedDB), so
 * this always exercises the first-run code path. The Mac / LLM server is
 * never contacted — seed data is bundled in the app.
 *
 * Expected counts come from lib/content/seed.ts:
 *   8 passages (A1×2, A2×2, B1×2, B2×2)     SEED_PASSAGE_COUNT
 *  12 prompts  (2 per level A1–C2)           SEED_PROMPT_COUNT
 *  20 cards    (5 per level × 4 levels)      SEED_CARD_COUNT
 */
const EXPECTED_PASSAGES = 8;
const EXPECTED_PROMPTS = 12;
const EXPECTED_CARDS = 20;

test("fresh install: SeedBootstrap shows passages, prompts, and cards without the Mac", async ({
  page,
}) => {
  await page.goto("/");

  // SeedBootstrap loads seed into IndexedDB then renders this element.
  // Allow up to 15 s on a slow machine.
  const seedReady = page.getByTestId("seed-ready");
  await expect(seedReady).toBeVisible({ timeout: 15_000 });

  // Verify the counts match the authored seed.
  await expect(seedReady).toContainText(`${EXPECTED_PASSAGES} passages`);
  await expect(seedReady).toContainText(`${EXPECTED_PROMPTS} prompts`);
  await expect(seedReady).toContainText(`${EXPECTED_CARDS} cards`);
});

test("seed bar reports non-zero passage, prompt, and card counts", async ({ page }) => {
  await page.goto("/");
  const seedReady = page.getByTestId("seed-ready");
  await expect(seedReady).toBeVisible({ timeout: 15_000 });

  const text = (await seedReady.textContent()) ?? "";
  // E.g. "8 passages · 12 prompts · 20 cards ready offline"
  expect(text).toMatch(/\d+ passages/);
  expect(text).toMatch(/\d+ prompts/);
  expect(text).toMatch(/\d+ cards/);
  expect(Number(text.match(/(\d+) passages/)?.[1])).toBeGreaterThan(0);
  expect(Number(text.match(/(\d+) prompts/)?.[1])).toBeGreaterThan(0);
  expect(Number(text.match(/(\d+) cards/)?.[1])).toBeGreaterThan(0);
});

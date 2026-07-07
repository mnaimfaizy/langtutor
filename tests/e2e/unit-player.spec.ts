import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

// Issue #59 — unit player tracer. A fresh account's first (backbone-seeded) unit contains a
// review activity then a reading activity (the two wired end-to-end so far — see
// lib/path/backbone-planner.ts). Completing both completes the unit and unlocks the next one.
const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword — see onboarding.spec.ts

const MOCK_PASSAGE = {
  title: "Everyday Habits",
  body: "Every day, Sam wakes up early and drinks a cup of tea. He walks to work because the office is close to his house. At lunch, he eats a sandwich with his friends. In the evening, he reads a book before he goes to sleep. Sam likes his simple daily routine because it helps him feel calm and ready for each new day.",
};

test.beforeEach(async ({ request, page }) => {
  // Both /path/[id] and (within this spec, run in isolation) /reading/[id] are dynamic
  // routes not pre-warmed by tests/e2e/auth.setup.ts, so this spec pays two cold Turbopack
  // compiles (10-30 s each, see .sandcastle/ENVIRONMENT.md) on top of the review/reading
  // flow itself — give it more headroom than the 60 s default.
  test.setTimeout(150_000);
  await request.post("/api/test/reset");
  // The unit's reading activity is generated on first open via the same endpoint the
  // standalone reading module uses — mock it so no Mac is required (same pattern as
  // tests/e2e/reading.spec.ts).
  await page.route("**/api/reading/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ passage: MOCK_PASSAGE }),
    });
  });
});

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

test("open first unit, complete review then reading, unit completes and unlocks the next", async ({
  page,
}) => {
  await setupWithSeed(page);

  const firstUnit = page.getByTestId("unit-0");
  await expect(firstUnit).toBeVisible();
  const unitId = await firstUnit.getAttribute("data-unit-id");
  expect(unitId).toBeTruthy();

  await firstUnit.click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Ordered activity list: review first, reading second ──────────────────
  await expect(page.getByTestId("unit-activity-0")).toContainText("Vocabulary review");
  await expect(page.getByTestId("unit-activity-1")).toContainText("Reading");
  await expect(page.getByTestId("unit-activity-0")).toContainText("Up next");
  await expect(page.getByTestId("btn-start-activity-0")).toHaveText("Start");

  // ── Activity 1: review, embedded in the unit ──────────────────────────────
  await page.getByTestId("btn-start-activity-0").click();
  await page.waitForURL(`/review?unit=${unitId}&activity=0`);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();

  await rateAllDueCardsGood(page);
  await expect(page.getByTestId("review-summary")).toBeVisible();
  await page.getByTestId("btn-back-to-unit-or-home").click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Back on the unit: review is done, reading is now next ────────────────
  await expect(page.getByTestId("unit-activity-0")).toContainText("Done");
  await expect(page.getByTestId("unit-activity-1")).toContainText("Up next");

  // ── Activity 2: reading, generated + embedded in the unit ────────────────
  await page.getByTestId("btn-start-activity-1").click();
  await page.waitForURL(/\/reading\/\d+\?unit=\d+&activity=1$/);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);

  await page.getByTestId("btn-complete-reading").click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Unit complete ──────────────────────────────────────────────────────
  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
  await expect(page.getByTestId("unit-activity-1")).toContainText("Done");

  // ── Next unit unlocks on home ─────────────────────────────────────────────
  await page.goto("/home");
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "completed");
  await expect(page.getByTestId("unit-1")).toHaveAttribute("data-status", "available");
});

test("re-entering a partially-done unit resumes at the first pending activity", async ({
  page,
}) => {
  await setupWithSeed(page);

  const firstUnit = page.getByTestId("unit-0");
  const unitId = await firstUnit.getAttribute("data-unit-id");
  await firstUnit.click();
  await page.waitForURL(`/path/${unitId}`);

  await page.getByTestId("btn-start-activity-0").click();
  await page.waitForURL(`/review?unit=${unitId}&activity=0`);
  await rateAllDueCardsGood(page);
  await expect(page.getByTestId("review-summary")).toBeVisible();
  await page.getByTestId("btn-back-to-unit-or-home").click();
  await page.waitForURL(`/path/${unitId}`);

  // Leave the unit entirely (home) then come back — resume should land on the reading
  // activity, not restart from review.
  await page.goto("/home");
  await page.getByTestId(`unit-${0}`).click();
  await page.waitForURL(`/path/${unitId}`);

  await expect(page.getByTestId("unit-activity-0")).toContainText("Done");
  await expect(page.getByTestId("unit-activity-1")).toContainText("Up next");
  await expect(page.getByTestId("btn-start-activity-1")).toBeVisible();
});

import { type Page, expect, test } from "./fixtures";

// Issue #61 — path buffer + offline grace. Exercises the full story end to end:
//   1. A unit activity the buffer already pre-generated (mocked as an earlier successful
//      generate call, same lazy generate-and-cache pattern that pre-generation reuses) plays
//      straight through even once the provider goes unreachable — no second network call.
//   2. A not-yet-buffered activity, attempted while the provider is unreachable, shows the
//      graceful-pause state instead of a bare error — offering SRS review and cached reading.
//   3. Once the provider is reachable again, the same activity generates normally and the
//      path continues.
//
// Prior art: tests/e2e/offline.spec.ts (offline-safe module checks) and
// tests/e2e/unit-player.spec.ts (embedded activity flow this spec extends).
const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword — see onboarding.spec.ts

const MOCK_PASSAGE = {
  title: "Everyday Habits",
  body: "Every day, Sam wakes up early and drinks a cup of tea. He walks to work because the office is close to his house. At lunch, he eats a sandwich with his friends. In the evening, he reads a book before he goes to sleep. Sam likes his simple daily routine because it helps him feel calm and ready for each new day.",
};

test.beforeEach(async ({ request }) => {
  test.setTimeout(180_000);
  await request.post("/api/test/reset");
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

test("buffered content plays offline; an ungenerated activity pauses gracefully and resumes once reachable", async ({
  page,
}) => {
  // Toggles the mocked reading-generation endpoint between "provider reachable" and
  // "provider unreachable" (503, matching /api/llm/health's own unreachable status) —
  // standing in for the Mac going away and coming back, same as the real generate routes'
  // own failure mode when the Mac can't be reached.
  let providerReachable = true;
  await page.route("**/api/reading/generate", async (route) => {
    if (!providerReachable) {
      await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ passage: MOCK_PASSAGE }),
    });
  });

  await setupWithSeed(page);

  const firstUnit = page.getByTestId("unit-0");
  await expect(firstUnit).toBeVisible();
  const unitId = await firstUnit.getAttribute("data-unit-id");
  expect(unitId).toBeTruthy();

  await firstUnit.click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Activity 0: review — needs no generated content, always offline-safe ────────────
  await page.getByTestId("btn-start-activity-0").click();
  await page.waitForURL(`/review?unit=${unitId}&activity=0`);
  await rateAllDueCardsGood(page);
  await expect(page.getByTestId("review-summary")).toBeVisible();
  await page.getByTestId("btn-back-to-unit-or-home").click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Activity 1 (listening): generated once while the provider is reachable — this is
  // the "buffer already did this ahead of time" content the replenishment pass would have
  // pre-generated. Its contentId is now cached on the unit. ──────────────────────────────
  await expect(page.getByTestId("unit-activity-1")).toContainText("Up next");
  await page.getByTestId("btn-start-activity-1").click();
  await page.waitForURL(/\/listening\/\d+\?unit=\d+&activity=1$/);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);

  await page.getByTestId("transcript-input").fill(MOCK_PASSAGE.body);
  await page.getByTestId("btn-check").click();
  await expect(page.getByTestId("btn-complete-dictation")).toBeEnabled();
  await page.getByTestId("btn-complete-dictation").click();
  await page.waitForURL(`/path/${unitId}`);
  await expect(page.getByTestId("unit-activity-1")).toContainText("Done");

  // ── Provider goes unreachable ────────────────────────────────────────────────────────
  providerReachable = false;

  // Re-entering the now-buffered listening activity plays straight through with no further
  // network call to the generate endpoint — proves offline progression through buffered
  // content works exactly as online (ADR 0015).
  await page.goto("/home");
  await page.getByTestId(`unit-${0}`).click();
  await page.waitForURL(`/path/${unitId}`);
  await expect(page.getByTestId("unit-activity-2")).toContainText("Up next");

  // ── Activity 2 (reading): never generated — the buffer hasn't reached it. Attempting it
  // while the provider is unreachable shows the graceful-pause state (ADR 0015). ──────────
  await page.getByTestId("btn-start-activity-2").click();
  const paused = page.getByTestId("path-paused");
  await expect(paused).toBeVisible({ timeout: 10_000 });

  // The pause state still offers something to do: SRS review works fully offline.
  await page.getByTestId("btn-review-instead").click();
  await page.waitForURL(/\/review/);
  await expect(page.getByTestId("review-session")).toBeVisible({ timeout: 10_000 });

  // ...and cached standalone reading content remains browsable.
  await page.goto(`/path/${unitId}`);
  await page.getByTestId("btn-start-activity-2").click();
  await expect(page.getByTestId("path-paused")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("btn-browse-cached").click();
  await page.waitForURL("/reading");
  await expect(page.getByTestId("passage-library")).toBeVisible({ timeout: 10_000 });

  // ── The provider comes back — the path resumes without any special user action ──────────
  providerReachable = true;
  await page.goto(`/path/${unitId}`);
  await page.getByTestId("btn-start-activity-2").click();
  await page.waitForURL(/\/reading\/\d+\?unit=\d+&activity=2$/);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);
});

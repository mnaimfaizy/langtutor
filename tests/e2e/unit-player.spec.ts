import { type Page, expect, test } from "./fixtures";
import { MOCK_PASSAGE, MOCK_PROMPT } from "./stub-mac-apis";

// Issue #59 — unit player tracer (review + reading wired end-to-end); issue #60 widens the
// backbone to all five module types (see lib/path/backbone-planner.ts) and gives listening,
// writing, and speaking the same embedded-in-unit presentation. Speaking's completion (real
// microphone capture + Whisper transcription) isn't exercised here — no standalone e2e spec
// covers that recorder flow either — so this spec completes review, listening, reading, and
// writing, matching the issue's e2e acceptance criterion.
const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword — see onboarding.spec.ts

test.beforeEach(async ({ request }) => {
  test.setTimeout(180_000);
  await request.post("/api/test/reset");
  // Mac-facing APIs are stubbed by tests/e2e/fixtures.ts (stubMacApis).
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

test("open first unit, complete review, listening, reading, and writing activities embedded in the unit", async ({
  page,
}) => {
  await setupWithSeed(page);

  const firstUnit = page.getByTestId("unit-0");
  await expect(firstUnit).toBeVisible();
  const unitId = await firstUnit.getAttribute("data-unit-id");
  expect(unitId).toBeTruthy();

  await firstUnit.click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Ordered activity list: review, listening, reading, writing, speaking ─────
  await expect(page.getByTestId("unit-activity-0")).toContainText("Vocabulary review");
  await expect(page.getByTestId("unit-activity-1")).toContainText("Listening");
  await expect(page.getByTestId("unit-activity-2")).toContainText("Reading");
  await expect(page.getByTestId("unit-activity-3")).toContainText("Writing");
  await expect(page.getByTestId("unit-activity-4")).toContainText("Speaking");
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

  // ── Back on the unit: review is done, listening is now next ──────────────
  await expect(page.getByTestId("unit-activity-0")).toContainText("Done");
  await expect(page.getByTestId("unit-activity-1")).toContainText("Up next");

  // ── Activity 2: listening, generated + embedded in the unit ──────────────
  await page.getByTestId("btn-start-activity-1").click();
  await page.waitForURL(/\/listening\/\d+\?unit=\d+&activity=1$/);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);

  const completeDictation = page.getByTestId("btn-complete-dictation");
  await expect(completeDictation).toBeDisabled();
  await page.getByTestId("transcript-input").fill(MOCK_PASSAGE.body);
  await page.getByTestId("btn-check").click();
  await expect(completeDictation).toBeEnabled();
  await completeDictation.click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Back on the unit: listening is done, reading is now next ─────────────
  await expect(page.getByTestId("unit-activity-1")).toContainText("Done");
  await expect(page.getByTestId("unit-activity-2")).toContainText("Up next");

  // ── Activity 3: reading, generated + embedded in the unit ────────────────
  await page.getByTestId("btn-start-activity-2").click();
  await page.waitForURL(/\/reading\/\d+\?unit=\d+&activity=2$/);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);

  await page.getByTestId("btn-complete-reading").click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Back on the unit: reading is done, writing is now next ───────────────
  await expect(page.getByTestId("unit-activity-2")).toContainText("Done");
  await expect(page.getByTestId("unit-activity-3")).toContainText("Up next");

  // ── Activity 4: writing, generated + embedded in the unit ────────────────
  await page.getByTestId("btn-start-activity-3").click();
  await page.waitForURL(/\/writing\/\d+\?unit=\d+&activity=3$/);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();
  await expect(page.getByTestId("prompt-title")).toHaveText(MOCK_PROMPT.title);

  const completeWriting = page.getByTestId("btn-complete-writing");
  await expect(completeWriting).toBeDisabled();
  await page.locator("#draft").fill("This morning I woke up, drank tea, and read a book.");
  await page.getByTestId("btn-submit").click();
  await expect(page.getByTestId("feedback-panel")).toBeVisible();
  await expect(completeWriting).toBeEnabled();
  await completeWriting.click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Back on the unit: writing is done, speaking remains — unit not complete yet ──
  await expect(page.getByTestId("unit-activity-3")).toContainText("Done");
  await expect(page.getByTestId("unit-activity-4")).toContainText("Up next");
  await expect(page.getByTestId("unit-complete-message")).not.toBeVisible();
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

  // Leave the unit entirely (home) then come back — resume should land on the listening
  // activity, not restart from review.
  await page.goto("/home");
  await page.getByTestId(`unit-${0}`).click();
  await page.waitForURL(`/path/${unitId}`);

  await expect(page.getByTestId("unit-activity-0")).toContainText("Done");
  await expect(page.getByTestId("unit-activity-1")).toContainText("Up next");
  await expect(page.getByTestId("btn-start-activity-1")).toBeVisible();
});

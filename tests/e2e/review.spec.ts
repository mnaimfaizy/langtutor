import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword

/** Complete onboarding and wait for the seed to be ready. */
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
  await page.waitForURL("/");
  // Wait for the seed to be loaded into IndexedDB before navigating to /review
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
}

test("review: smoke test — can reveal a card and rate it", async ({ page }) => {
  await setupWithSeed(page);
  await page.goto("/review");

  await expect(page.getByTestId("review-session")).toBeVisible();
  await expect(page.getByTestId("review-card")).toBeVisible();

  // Front: word is visible, definition is not
  await expect(page.getByTestId("card-word")).toBeVisible();
  await expect(page.getByTestId("card-definition")).not.toBeVisible();

  // Reveal the card
  await page.getByTestId("btn-reveal").click();
  await expect(page.getByTestId("card-definition")).toBeVisible();

  // Rate buttons are now visible
  await expect(page.getByTestId("btn-rate-again")).toBeVisible();
  await expect(page.getByTestId("btn-rate-hard")).toBeVisible();
  await expect(page.getByTestId("btn-rate-good")).toBeVisible();
  await expect(page.getByTestId("btn-rate-easy")).toBeVisible();

  // Rate the card — next card or summary should appear
  await page.getByTestId("btn-rate-good").click();

  // After rating, definition is hidden (next card front or summary)
  const summaryVisible = await page.getByTestId("review-summary").isVisible();
  const nextCardVisible = await page.getByTestId("review-card").isVisible();
  expect(summaryVisible || nextCardVisible).toBe(true);
});

test("review: full session updates all card states and reaches summary", async ({ page }) => {
  await setupWithSeed(page);
  await page.goto("/review");

  await expect(page.getByTestId("review-session")).toBeVisible();

  // Rate every due card as "good". After each rating the component either
  // shows the next card's front (btn-reveal) or the summary — wait for one
  // of the two so we don't race against the async IndexedDB write.
  let rated = 0;
  while (true) {
    await page.waitForSelector('[data-testid="btn-reveal"], [data-testid="review-summary"]', {
      timeout: 10_000,
    });
    if ((await page.getByTestId("review-summary").count()) > 0) break;

    await page.getByTestId("btn-reveal").click();
    await expect(page.getByTestId("card-definition")).toBeVisible();
    await page.getByTestId("btn-rate-good").click();
    rated++;
    if (rated > 30) break; // safety valve
  }

  expect(rated).toBeGreaterThan(0);
  await expect(page.getByTestId("review-summary")).toBeVisible();

  // Summary shows the correct total count
  await expect(page.getByTestId("summary-count-good")).toContainText(String(rated));
  await expect(page.getByTestId("summary-count-again")).toContainText("0");
});

test("review: empty state when no cards are due", async ({ page }) => {
  await setupWithSeed(page);
  await page.goto("/review");

  // Rate every card to clear the queue
  let rated = 0;
  while (true) {
    await page.waitForSelector('[data-testid="btn-reveal"], [data-testid="review-summary"]', {
      timeout: 10_000,
    });
    if ((await page.getByTestId("review-summary").count()) > 0) break;

    await page.getByTestId("btn-reveal").click();
    await page.getByTestId("btn-rate-good").click();
    rated++;
    if (rated > 30) break;
  }

  // Return home then come back — all cards are now scheduled for the future
  await page.getByRole("link", { name: "Back to home" }).click();
  await page.waitForURL("/");
  await page.goto("/review");

  await expect(page.getByTestId("review-session")).toBeVisible();
  await expect(page.getByTestId("review-empty")).toBeVisible();
});

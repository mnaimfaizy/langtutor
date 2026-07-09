import { type Page, expect, test } from "./fixtures";

test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
});

/** Complete onboarding and wait for the seed to be ready. */
async function setupWithSeed(page: Page) {
  await page.goto("/onboarding");
  await page.getByTestId("quiz-start-btn").click();
  await expect(page.getByTestId("quiz-quizzing")).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.getByTestId("btn-unknown").click();
  }
  await page.getByTestId("btn-save-level").click();
  await expect(page.getByTestId("goals-picker")).toBeVisible();
  await page.getByTestId("goal-btn-general").click();
  await page.getByTestId("btn-save-goals").click();
  await page.waitForURL("/home");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
}

test("deck browser: Review these scopes review to the active filter", async ({ page }) => {
  await setupWithSeed(page);
  await page.goto("/deck");
  await expect(page.getByTestId("deck-browser")).toBeVisible();

  await expect(page.getByTestId("btn-review-these")).toHaveCount(0);

  await page.getByTestId("deck-filter-cefr-A1").click();
  await expect(page.getByTestId("btn-review-these")).toBeVisible();

  await page.getByTestId("btn-review-these").click();
  await page.waitForURL(/\/review\?cards=/);
  await expect(page.getByTestId("review-session")).toBeVisible();
  await expect(page.getByTestId("review-progress")).toHaveText("1 / 5");
});

test("review: full-deck flow is unchanged without scoped cards param", async ({ page }) => {
  await setupWithSeed(page);
  await page.goto("/review");
  await expect(page.getByTestId("review-session")).toBeVisible();
  await expect(page.getByTestId("review-progress")).toHaveText("1 / 20");
});

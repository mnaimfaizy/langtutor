import { expect, test } from "@playwright/test";

const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword

test("placement quiz: completes with all-unknown answers → A1 → saves and redirects", async ({
  page,
}) => {
  await page.goto("/onboarding");

  // Intro screen should appear
  await expect(page.getByTestId("quiz-intro")).toBeVisible();
  await page.getByTestId("quiz-start-btn").click();

  // Quiz screen should appear
  await expect(page.getByTestId("quiz-quizzing")).toBeVisible();

  // Answer every word in the first batch as "Don't know" — stops at A1
  for (let i = 0; i < BATCH_SIZE; i++) {
    await page.getByTestId("btn-unknown").click();
  }

  // Result screen: should show A1
  await expect(page.getByTestId("quiz-result")).toBeVisible();
  await expect(page.getByTestId("quiz-result-level")).toHaveText("A1");

  // Save and get redirected to home
  await page.getByTestId("btn-save-level").click();
  await page.waitForURL("/");
});

test("placement quiz: redirects home if already onboarded", async ({ page }) => {
  // Complete onboarding first
  await page.goto("/onboarding");
  await expect(page.getByTestId("quiz-intro")).toBeVisible();
  await page.getByTestId("quiz-start-btn").click();
  await expect(page.getByTestId("quiz-quizzing")).toBeVisible();

  for (let i = 0; i < BATCH_SIZE; i++) {
    await page.getByTestId("btn-unknown").click();
  }
  await page.getByTestId("btn-save-level").click();
  await page.waitForURL("/");

  // Revisiting /onboarding should redirect straight to /
  await page.goto("/onboarding");
  await page.waitForURL("/");
});

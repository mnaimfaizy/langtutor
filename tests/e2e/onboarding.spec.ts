import { expect, test } from "@playwright/test";

const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword

// Each onboarding test requires a profile-free DB so PlacementQuiz shows the
// quiz rather than redirecting. Reset before each test rather than relying on
// the global setup's state, because other parallel/prior tests may save a profile.
test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
});

test("placement quiz: completes with all-unknown answers → A1 → proceeds to goals → redirects home", async ({
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

  // Save level → navigates to goals picker
  await page.getByTestId("btn-save-level").click();
  await expect(page.getByTestId("goals-picker")).toBeVisible();

  // Select a goal and save
  await page.getByTestId("goal-btn-general").click();
  await page.getByTestId("btn-save-goals").click();
  await page.waitForURL("/home");
});

test("placement quiz: redirects home if already onboarded", async ({ page }) => {
  // Complete full onboarding first
  await page.goto("/onboarding");
  await expect(page.getByTestId("quiz-intro")).toBeVisible();
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

  // Revisiting /onboarding should redirect straight to /home
  await page.goto("/onboarding");
  await page.waitForURL("/home");
});

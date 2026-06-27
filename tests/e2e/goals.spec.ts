import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword

// Each goals test starts from /onboarding (clean profile) and saves a profile.
// Resetting before each test prevents bleed from other tests or prior runs.
test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
});

async function completeOnboarding(page: Page) {
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
}

test("goals: level and goals persist across reload", async ({ page }) => {
  await completeOnboarding(page);
  await page.goto("/settings");

  await expect(page.getByTestId("profile-section")).toBeVisible();
  await expect(page.getByTestId("profile-level-select")).toHaveValue("A1");
  await expect(page.getByTestId("profile-goal-btn-general")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Reload and verify persistence
  await page.reload();
  await expect(page.getByTestId("profile-level-select")).toHaveValue("A1");
  await expect(page.getByTestId("profile-goal-btn-general")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("goals: can edit goals in settings and changes persist", async ({ page }) => {
  await completeOnboarding(page);
  await page.goto("/settings");

  await expect(page.getByTestId("profile-section")).toBeVisible();

  // Initially only "general" is selected
  await expect(page.getByTestId("profile-goal-btn-general")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("profile-goal-btn-travel")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // Add "travel"
  await page.getByTestId("profile-goal-btn-travel").click();
  await page.getByTestId("btn-save-profile").click();

  // Banner confirms save
  await expect(page.getByRole("status")).toHaveText("Profile updated.");

  // Reload and verify both goals persist
  await page.reload();
  await expect(page.getByTestId("profile-goal-btn-general")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("profile-goal-btn-travel")).toHaveAttribute("aria-pressed", "true");
});

test("goals: can change level in settings", async ({ page }) => {
  await completeOnboarding(page);
  await page.goto("/settings");

  await expect(page.getByTestId("profile-level-select")).toHaveValue("A1");

  // Change level to B1
  await page.getByTestId("profile-level-select").selectOption("B1");
  await page.getByTestId("btn-save-profile").click();
  await expect(page.getByRole("status")).toHaveText("Profile updated.");

  // Reload and verify
  await page.reload();
  await expect(page.getByTestId("profile-level-select")).toHaveValue("B1");
});

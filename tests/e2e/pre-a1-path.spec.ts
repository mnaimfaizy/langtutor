/**
 * Issue #66 — pre-A1 tier path plumbing. Kid-mode learners start with negative-index
 * placeholder units; adult learners opt in via Settings. Within-pre-A1 unlock stays
 * completion-based; the pre-A1 → A1 chapter gate (issue #114) holds unit 0 in strict mode.
 */
import { type Page, expect, test } from "./fixtures";

const BATCH_SIZE = 6;

test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
});

async function completeOnboardingToHome(page: Page): Promise<void> {
  await page.goto("/onboarding");
  await page.getByTestId("quiz-start-btn").click();
  for (let i = 0; i < BATCH_SIZE; i++) {
    await page.getByTestId("btn-unknown").click();
  }
  await page.getByTestId("btn-save-level").click();
  await page.getByTestId("goal-btn-general").click();
  await page.getByTestId("btn-save-goals").click();
  await page.waitForURL("/home");
}

test.use({ storageState: { cookies: [], origins: [] } });

async function signUpKid(page: Page): Promise<void> {
  const email = `prea1-kid-${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByTestId("signup-mode-btn-kid").click();
  await page.getByTestId("signup-mode-continue").click();
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill("TestPassword1!");
  await page.locator("#confirm").fill("TestPassword1!");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("/onboarding");
}

test("kid-mode home starts with pre-A1 units before unit 0", async ({ page }) => {
  await signUpKid(page);
  await completeOnboardingToHome(page);

  const firstPreA1 = page.getByTestId("unit--4");
  const unit0 = page.getByTestId("unit-0");

  await expect(firstPreA1).toBeVisible();
  await expect(firstPreA1).toHaveAttribute("data-status", "available");
  await expect(firstPreA1.getByText("Pre-A1")).toBeVisible();
  await expect(unit0).toHaveAttribute("data-status", "locked");
});

test("adult opt-in toggle seeds pre-A1 units without affecting A1+ nodes", async ({ page }) => {
  await completeOnboardingToHome(page);

  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "available");
  await expect(page.getByTestId("unit--4")).toHaveCount(0);

  await page.goto("/settings");
  await expect(page.getByTestId("pre-a1-settings-section")).toBeVisible();
  await page.getByTestId("enable-pre-a1-checkbox").check();
  await page.getByTestId("btn-save-pre-a1").click();
  await expect(page.getByRole("status")).toHaveText("Beginner path updated.");

  await page.goto("/home");
  await expect(page.getByTestId("unit--4")).toHaveAttribute("data-status", "available");
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "locked");
  await expect(page.getByTestId("unit-1")).toHaveAttribute("data-status", "locked");
});

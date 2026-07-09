/**
 * Issue #55 — sign-up funnel: experience-mode step + continuous flow into onboarding
 * (ADR 0014). Verifies the kid/adult chooser persists the mode, sign-up routes straight
 * into onboarding (no detour through the module hub), and onboarding immediately reflects
 * the chosen palette + copy register. Existing login e2e (auth-gate.spec.ts) is unaffected —
 * post-login routing to /home is untouched.
 */
import { type Page, expect, test } from "./fixtures";

// Auth screens are reached before sign-in — drop the shared session storage state.
test.use({ storageState: { cookies: [], origins: [] } });

async function signUp(page: Page, mode: "kid" | "adult"): Promise<void> {
  const email = `signup-${mode}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  await page.goto("/sign-up");
  await expect(page.getByTestId("signup-mode-step")).toBeVisible();

  // Continue is disabled until a mode is explicitly chosen.
  await expect(page.getByTestId("signup-mode-continue")).toBeDisabled();
  await page.getByTestId(`signup-mode-btn-${mode}`).click();
  await expect(page.getByTestId(`signup-mode-btn-${mode}`)).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("signup-mode-continue").click();

  await expect(page.getByTestId("signup-account-step")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill("TestPassword1!");
  await page.locator("#confirm").fill("TestPassword1!");
  await page.getByRole("button", { name: /create account/i }).click();

  await page.waitForURL("/onboarding");
}

test("kid sign-up: lands directly in onboarding with the kid palette and kid-register copy", async ({
  page,
}) => {
  await signUp(page, "kid");

  await expect(page.locator("html")).toHaveAttribute("data-palette", /^kid-/);
  await expect(page.getByTestId("quiz-intro")).toBeVisible();
  await expect(page.getByTestId("quiz-start-btn")).toHaveText("Let's play!");
});

test("adult sign-up: lands directly in onboarding with the adult palette and adult copy", async ({
  page,
}) => {
  await signUp(page, "adult");

  await expect(page.locator("html")).toHaveAttribute("data-palette", /^adult-/);
  await expect(page.getByTestId("quiz-intro")).toBeVisible();
  await expect(page.getByTestId("quiz-start-btn")).toHaveText("Start quiz");
});

test("kid mode survives through the full onboarding journey into the module hub", async ({
  page,
}) => {
  await signUp(page, "kid");

  await page.getByTestId("quiz-start-btn").click();
  await expect(page.getByTestId("quiz-quizzing")).toBeVisible();

  // Answer every word as unknown — stops at A1 quickly regardless of register.
  const BATCH_SIZE = 6;
  for (let i = 0; i < BATCH_SIZE; i++) {
    await page.getByTestId("btn-unknown").click();
  }

  await expect(page.getByTestId("quiz-result")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-palette", /^kid-/);
  await page.getByTestId("btn-save-level").click();

  await expect(page.getByTestId("goals-picker")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-palette", /^kid-/);
  await expect(page.getByRole("heading", { name: "What do you want to learn for?" })).toBeVisible();

  await page.getByTestId("goal-btn-general").click();
  await page.getByTestId("btn-save-goals").click();
  await page.waitForURL("/home");
  await expect(page.locator("html")).toHaveAttribute("data-palette", /^kid-/);
});

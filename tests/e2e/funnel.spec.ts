/**
 * Issue #56 — QA gate closing workstream 2 (PRD #37). Proves the whole public funnel
 * holds together as one continuous journey rather than as isolated slices: anonymous
 * visitor → landing page → sign-up CTA → account creation (kid and adult) → onboarding
 * → first activity, plus the returning-authenticated-user short-circuit at the root.
 *
 * This complements (does not replace) the slice-level specs: marketing-landing.spec.ts
 * (landing content/CTAs), sign-up-onboarding.spec.ts (mode step + onboarding handoff),
 * onboarding.spec.ts / goals.spec.ts (quiz + goals mechanics), and auth-gate.spec.ts
 * (root redirect rules in isolation).
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword — see onboarding.spec.ts

async function fullFunnelJourney(page: Page, mode: "kid" | "adult"): Promise<void> {
  const email = `funnel-${mode}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  // ── 1. Anonymous visitor lands on the public marketing page ────────────────
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();
  await expect(page.getByTestId("btn-marketing-sign-up")).toBeVisible();

  // ── 2. Sign-up CTA → the two-step sign-up funnel ────────────────────────────
  await page.getByTestId("btn-marketing-sign-up").click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByTestId("signup-mode-step")).toBeVisible();

  await expect(page.getByTestId("signup-mode-continue")).toBeDisabled();
  await page.getByTestId(`signup-mode-btn-${mode}`).click();
  await expect(page.getByTestId(`signup-mode-btn-${mode}`)).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("signup-mode-continue").click();

  await expect(page.getByTestId("signup-account-step")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill("TestPassword1!");
  await page.locator("#confirm").fill("TestPassword1!");
  await page.getByRole("button", { name: /create account/i }).click();

  // ── 3. Account created → straight into onboarding, correct palette ─────────
  await page.waitForURL("/onboarding");
  await expect(page.locator("html")).toHaveAttribute("data-palette", new RegExp(`^${mode}-`));
  await expect(page.getByTestId("quiz-intro")).toBeVisible();

  await page.getByTestId("quiz-start-btn").click();
  await expect(page.getByTestId("quiz-quizzing")).toBeVisible();
  for (let i = 0; i < BATCH_SIZE; i++) {
    await page.getByTestId("btn-unknown").click();
  }

  await expect(page.getByTestId("quiz-result")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-palette", new RegExp(`^${mode}-`));
  await page.getByTestId("btn-save-level").click();

  // ── 4. Onboarding completes with a goal → the module hub ───────────────────
  await expect(page.getByTestId("goals-picker")).toBeVisible();
  await page.getByTestId("goal-btn-general").click();
  await page.getByTestId("btn-save-goals").click();
  await page.waitForURL("/home");
  await expect(page.locator("html")).toHaveAttribute("data-palette", new RegExp(`^${mode}-`));
  await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();

  // ── 5. From the hub into the first activity ─────────────────────────────────
  await page.getByTestId("btn-reading").click();
  await page.waitForURL("/reading");
  await expect(page.getByRole("heading", { name: "Reading", level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-palette", new RegExp(`^${mode}-`));
}

test.describe("full funnel: anonymous visitor to first activity", () => {
  // Auth screens are reached before sign-in — drop the shared session storage state.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("kid sign-up: landing → sign-up → kid onboarding → first activity", async ({ page }) => {
    test.setTimeout(90_000);
    await fullFunnelJourney(page, "kid");
  });

  test("adult sign-up: landing → sign-up → adult onboarding → first activity", async ({ page }) => {
    test.setTimeout(90_000);
    await fullFunnelJourney(page, "adult");
  });
});

test.describe("full funnel: returning authenticated user", () => {
  // Default project storage state is already an authenticated (onboarded) admin session.
  test("hitting the root skips marketing entirely and lands on the learning home", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { name: "Lang-Tutor", level: 1 })).toBeVisible();

    // The marketing-only CTAs must never render for an authenticated visitor.
    await expect(page.getByTestId("btn-marketing-sign-up")).toHaveCount(0);
    await expect(page.getByTestId("btn-marketing-login")).toHaveCount(0);
  });
});

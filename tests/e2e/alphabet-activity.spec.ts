/**
 * Issue #71 — alphabet activity in the first pre-A1 unit. Walks through all 26 letters
 * with media-store audio and illustrations, then marks the slot done via the unit player.
 */
import { type Page, expect, test } from "./fixtures";

import { PRE_A1_FIRST_PATH_INDEX } from "@/lib/path/shared-path-catalog";

const BATCH_SIZE = 6;
const ALPHABET_LENGTH = 26;

// Minimal valid WAV header — enough for <audio> playback in Chromium.
const TINY_WAV = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
  0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
  0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
]);

test.beforeEach(async ({ request, page }) => {
  test.setTimeout(180_000);
  await request.post("/api/test/reset");
  await page.route("**/api/audio/resolve**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: TINY_WAV,
    });
  });
});

test.use({ storageState: { cookies: [], origins: [] } });

async function signUpKid(page: Page): Promise<void> {
  const email = `alphabet-kid-${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByTestId("signup-mode-btn-kid").click();
  await page.getByTestId("signup-mode-continue").click();
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill("TestPassword1!");
  await page.locator("#confirm").fill("TestPassword1!");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("/onboarding");
}

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

test("pre-A1 alphabet unit renders letters with media and completes the slot", async ({ page }) => {
  await signUpKid(page);
  await completeOnboardingToHome(page);

  const firstPreA1 = page.getByTestId(`unit-${PRE_A1_FIRST_PATH_INDEX}`);
  await expect(firstPreA1).toBeVisible();
  await firstPreA1.click();

  await expect(page.getByTestId("unit-title")).toContainText("Alphabet");
  await expect(page.getByTestId("unit-activity-0")).toBeVisible();
  await page.getByTestId("btn-start-activity-0").click();

  await expect(page.getByTestId("alphabet-letter")).toHaveText("A");
  await expect(page.getByTestId("alphabet-picture")).toBeVisible();

  for (let i = 0; i < ALPHABET_LENGTH - 1; i++) {
    await page.getByTestId("btn-alphabet-next").click();
  }

  await expect(page.getByTestId("alphabet-letter")).toHaveText("Z");
  await page.getByTestId("btn-alphabet-next").click();

  await expect(page).toHaveURL(/\/path\/\d+$/);
  await expect(page.getByTestId("unit-activity-0")).toHaveAttribute("data-done", "true");
  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
});

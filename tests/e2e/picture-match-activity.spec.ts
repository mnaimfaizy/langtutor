/**
 * Issue #74 — picture-match activity in the third pre-A1 unit. Supports picture→word and
 * word→picture rounds with media-store images/audio, then marks the slot done via the unit player.
 */
import { type Page, expect, test } from "./fixtures";

import { PICTURE_MATCH_ROUNDS } from "@/lib/picture-match/vocab";

const BATCH_SIZE = 6;
const ALPHABET_LENGTH = 26;
const PICTURE_MATCH_ROUND_COUNT = PICTURE_MATCH_ROUNDS.length;

// Minimal valid WAV header — enough for <audio> playback in Chromium.
const TINY_WAV = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
  0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
  0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
]);

// 1×1 transparent PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test.beforeEach(async ({ request, page }) => {
  test.setTimeout(360_000);
  await request.post("/api/test/reset");
  await page.route("**/api/audio/resolve**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: TINY_WAV,
    });
  });
  await page.route("**/api/image/resolve**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TINY_PNG,
    });
  });
});

test.use({ storageState: { cookies: [], origins: [] } });

async function signUpKid(page: Page): Promise<void> {
  const email = `picture-match-kid-${Date.now()}@example.com`;
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
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
}

async function completeAlphabetUnit(page: Page): Promise<void> {
  await page.getByTestId("unit--4").click();
  await page.getByTestId("btn-start-activity-0").click();
  for (let i = 0; i < ALPHABET_LENGTH - 1; i++) {
    await page.getByTestId("btn-alphabet-next").click();
  }
  await page.getByTestId("btn-alphabet-next").click();
  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
  await page.goto("/home");
}

async function completePhonicsUnit(page: Page): Promise<void> {
  await page.getByTestId("unit--3").click();
  await page.getByTestId("btn-start-activity-0").click();
  for (let i = 0; i < ALPHABET_LENGTH; i++) {
    const letter = String.fromCharCode(97 + i);
    await page.getByTestId(`phonics-choice-${letter}`).click();
    await page.getByTestId("btn-phonics-next").click();
  }
  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
  await page.goto("/home");
}

test("pre-A1 picture-match unit scores both directions and completes the slot", async ({
  page,
}) => {
  await signUpKid(page);
  await completeOnboardingToHome(page);
  await completeAlphabetUnit(page);
  await completePhonicsUnit(page);

  const pictureMatchUnit = page.getByTestId("unit--2");
  await expect(pictureMatchUnit).toHaveAttribute("data-status", "available");
  await pictureMatchUnit.click();

  await expect(page.getByTestId("unit-title")).toContainText("Picture words");
  await page.getByTestId("btn-start-activity-0").click();

  await expect(page.getByTestId("picture-match-choices")).toBeVisible();

  for (let i = 0; i < PICTURE_MATCH_ROUND_COUNT; i++) {
    const round = PICTURE_MATCH_ROUNDS[i]!;
    const target = round.targetWord;

    if (round.direction === "picture-to-word") {
      await expect(page.getByTestId("picture-match-prompt-image")).toBeVisible();
    } else {
      await expect(page.getByTestId("btn-picture-match-listen")).toBeVisible();
    }

    await page.getByTestId(`picture-match-choice-${target}`).click();
    await expect(page.getByTestId("picture-match-feedback")).toBeVisible();
    await page.getByTestId("btn-picture-match-next").click();
  }

  await expect(page).toHaveURL(/\/path\/\d+$/);
  await expect(page.getByTestId("unit-activity-0")).toHaveAttribute("data-done", "true");
  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
});

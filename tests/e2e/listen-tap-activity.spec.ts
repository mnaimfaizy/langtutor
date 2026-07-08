/**
 * Issue #73 — listen-and-tap activity in the fourth pre-A1 unit. Plays audio with
 * media-store TTS, scores picture-choice taps, then marks the slot done via the unit player.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { LISTEN_TAP_ROUNDS } from "@/lib/listen-tap/vocab";

const BATCH_SIZE = 6;
const ALPHABET_LENGTH = 26;
const LISTEN_TAP_ROUND_COUNT = LISTEN_TAP_ROUNDS.length;

const MOCK_PASSAGE = {
  title: "Everyday Habits",
  body: "Every day, Sam wakes up early and drinks a cup of tea.",
};

const MOCK_PROMPT = {
  title: "Your Daily Routine",
  instruction: "Write a few sentences describing your typical morning routine.",
};

const MOCK_FEEDBACK = {
  overallScore: 8,
  structuralGrade: "Good",
  corrections: [],
};

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
  await page.route("**/api/reading/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ passage: MOCK_PASSAGE }),
    });
  });
  await page.route("**/api/writing/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ prompt: MOCK_PROMPT }),
    });
  });
  await page.route("**/api/writing/feedback", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ feedback: MOCK_FEEDBACK }),
    });
  });
  await page.route("**/api/stt/transcribe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ transcript: MOCK_PASSAGE.body }),
    });
  });
});

test.use({ storageState: { cookies: [], origins: [] } });

async function signUpKid(page: Page): Promise<void> {
  const email = `listen-tap-kid-${Date.now()}@example.com`;
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

async function rateAllDueCardsGood(page: Page): Promise<void> {
  const summary = page.getByTestId("review-summary");
  const reveal = page.getByTestId("btn-reveal");
  const rateGood = page.getByTestId("btn-rate-good");

  for (let i = 0; i < 40; i++) {
    if (await summary.isVisible()) return;
    await expect(reveal.or(summary)).toBeVisible({ timeout: 10_000 });
    if (await summary.isVisible()) return;
    await reveal.click();
    await expect(rateGood).toBeVisible({ timeout: 10_000 });
    await rateGood.click();
  }
}

async function completeSpeakingActivity(page: Page): Promise<void> {
  await page.getByRole("button", { name: /start recording/i }).click();
  await expect(page.getByRole("button", { name: /stop recording/i })).toBeVisible({
    timeout: 10_000,
  });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /stop recording/i }).click();
  await expect(page.getByRole("button", { name: /transcribe and score/i })).toBeEnabled({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /transcribe and score/i }).click();
  await expect(page.getByTestId("btn-complete-speaking")).toBeEnabled({ timeout: 15_000 });
  await page.getByTestId("btn-complete-speaking").click();
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

async function completeBackboneUnit(page: Page, unitTestId: string): Promise<void> {
  const unit = page.getByTestId(unitTestId);
  const unitId = await unit.getAttribute("data-unit-id");
  expect(unitId).toBeTruthy();
  await unit.click();
  await page.waitForURL(`/path/${unitId}`);

  await page.getByTestId("btn-start-activity-0").click();
  await page.waitForURL(`/review?unit=${unitId}&activity=0`);
  await rateAllDueCardsGood(page);
  await page.getByTestId("btn-back-to-unit-or-home").click();
  await page.waitForURL(`/path/${unitId}`);

  await page.getByTestId("btn-start-activity-1").click();
  await page.waitForURL(/\/listening\/\d+\?unit=\d+&activity=1$/);
  await page.getByTestId("transcript-input").fill(MOCK_PASSAGE.body);
  await page.getByTestId("btn-check").click();
  await page.getByTestId("btn-complete-dictation").click();
  await page.waitForURL(`/path/${unitId}`);

  await page.getByTestId("btn-start-activity-2").click();
  await page.waitForURL(/\/reading\/\d+\?unit=\d+&activity=2$/);
  await page.getByTestId("btn-complete-reading").click();
  await page.waitForURL(`/path/${unitId}`);

  await page.getByTestId("btn-start-activity-3").click();
  await page.waitForURL(/\/writing\/\d+\?unit=\d+&activity=3$/);
  await page.locator("#draft").fill("This morning I woke up and read a book.");
  await page.getByTestId("btn-submit").click();
  await expect(page.getByTestId("btn-complete-writing")).toBeEnabled();
  await page.getByTestId("btn-complete-writing").click();
  await page.waitForURL(`/path/${unitId}`);

  await page.getByTestId("btn-start-activity-4").click();
  await page.waitForURL(/\/speaking\/\d+\?unit=\d+&activity=4$/);
  await completeSpeakingActivity(page);
  await page.waitForURL(`/path/${unitId}`);

  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
  await page.goto("/home");
}

test("pre-A1 listen-and-tap unit plays audio, scores choices, and completes the slot", async ({
  page,
}) => {
  await signUpKid(page);
  await completeOnboardingToHome(page);
  await completeAlphabetUnit(page);
  await completePhonicsUnit(page);
  await completeBackboneUnit(page, "unit--2");

  const listenTapUnit = page.getByTestId("unit--1");
  await expect(listenTapUnit).toHaveAttribute("data-status", "available");
  await listenTapUnit.click();

  await expect(page.getByTestId("unit-title")).toContainText("Listen & tap");
  await page.getByTestId("btn-start-activity-0").click();

  await expect(page.getByTestId("listen-tap-choices")).toBeVisible();

  for (let i = 0; i < LISTEN_TAP_ROUND_COUNT; i++) {
    const target = LISTEN_TAP_ROUNDS[i]!.targetWord;
    await page.getByTestId(`listen-tap-choice-${target}`).click();
    await expect(page.getByTestId("listen-tap-feedback")).toBeVisible();
    await page.getByTestId("btn-listen-tap-next").click();
  }

  await expect(page).toHaveURL(/\/path\/\d+$/);
  await expect(page.getByTestId("unit-activity-0")).toHaveAttribute("data-done", "true");
  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
});

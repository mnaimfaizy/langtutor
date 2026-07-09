/**
 * Issue #89 — QA gate for the gamification revamp: end-to-end flow (celebration → HUD →
 * quests → collection), reduced-motion sweep across every celebration surface, and a
 * four-palette × two-experience-mode visual sweep for HUD / mascot / collection.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword — see onboarding.spec.ts

const MOCK_PASSAGE = {
  title: "Everyday Habits",
  body: "Every day, Sam wakes up early and drinks a cup of tea. He walks to work because the office is close to his house. At lunch, he eats a sandwich with his friends. In the evening, he reads a book before he goes to sleep. Sam likes his simple daily routine because it helps him feel calm and ready for each new day.",
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

interface Palette {
  name: "adult-light" | "adult-dark" | "kid-bright" | "kid-dark";
  mode: "adult" | "kid";
  colorScheme: "light" | "dark";
}

const ALL_PALETTES: Palette[] = [
  { name: "adult-light", mode: "adult", colorScheme: "light" },
  { name: "adult-dark", mode: "adult", colorScheme: "dark" },
  { name: "kid-bright", mode: "kid", colorScheme: "light" },
  { name: "kid-dark", mode: "kid", colorScheme: "dark" },
];

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test.beforeEach(async ({ request, page }) => {
  test.setTimeout(240_000);
  await request.post("/api/test/reset");
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

/** Completes onboarding and waits for the seed to be ready. */
async function setupWithSeed(page: Page) {
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
  await page.waitForURL("/home");
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
}

/** Rates every due card as "good" until the review session reaches its summary. */
async function rateAllDueCardsGood(page: Page): Promise<number> {
  const summary = page.getByTestId("review-summary");
  const reveal = page.getByTestId("btn-reveal");
  const rateGood = page.getByTestId("btn-rate-good");
  const progress = page.getByTestId("review-progress");

  let rated = 0;
  for (let i = 0; i < 40; i++) {
    if (await summary.isVisible()) break;
    await expect(reveal.or(summary)).toBeVisible({ timeout: 10_000 });
    if (await summary.isVisible()) break;

    const text = (await progress.textContent()) ?? "";
    const [posStr, totalStr] = text.split("/").map((s) => s.trim());
    const isLast = Number(posStr) >= Number(totalStr);

    await reveal.click();
    await expect(rateGood).toBeVisible({ timeout: 10_000 });
    await rateGood.click();
    rated++;

    if (isLast) {
      await expect(summary).toBeVisible({ timeout: 10_000 });
      break;
    }
    await expect(progress).toHaveText(`${Number(posStr) + 1} / ${totalStr}`, { timeout: 10_000 });
  }
  return rated;
}

/** Waits for the level-up beat (when applicable) and session celebration to auto-dismiss. */
async function waitForCelebrationSequence(page: Page) {
  const levelUp = page.getByTestId("level-up-overlay");
  if (await levelUp.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await expect(levelUp).toBeHidden({ timeout: 12_000 });
  }
  const celebration = page.getByTestId("celebration-overlay");
  if (await celebration.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await expect(celebration).toBeHidden({ timeout: 12_000 });
  }
}

async function setPalette(page: Page, palette: Palette) {
  await page.emulateMedia({ colorScheme: palette.colorScheme });
  await page.goto("/settings");
  await page.getByTestId(`experience-mode-btn-${palette.mode}`).click();
  await page.getByTestId("btn-save-experience-mode").click();
  await expect(page.getByRole("status")).toHaveText("Appearance saved.");
  await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
}

async function completeSpeakingActivity(page: Page) {
  const startBtn = page.getByRole("button", { name: /start recording/i });
  await expect(startBtn).toBeVisible({ timeout: 10_000 });
  await startBtn.click();

  const stopBtn = page.getByRole("button", { name: /stop recording/i });
  await expect(stopBtn).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await stopBtn.click();

  const transcribeBtn = page.getByRole("button", { name: /transcribe and score/i });
  await expect(transcribeBtn).toBeEnabled({ timeout: 15_000 });
  await transcribeBtn.click();

  const completeSpeaking = page.getByTestId("btn-complete-speaking");
  await expect(completeSpeaking).toBeEnabled({ timeout: 15_000 });
  await completeSpeaking.click();
}

/** Completes every activity in unit 0 (review → speaking) and returns the unit id. */
async function completeFirstUnit(page: Page): Promise<string> {
  const firstUnit = page.getByTestId("unit-0");
  const unitId = await firstUnit.getAttribute("data-unit-id");
  expect(unitId).toBeTruthy();

  await firstUnit.click();
  await page.waitForURL(`/path/${unitId}`);

  await page.getByTestId("btn-start-activity-0").click();
  await page.waitForURL(`/review?unit=${unitId}&activity=0`);
  await rateAllDueCardsGood(page);
  await waitForCelebrationSequence(page);
  await expect(page.getByTestId("review-summary")).toBeVisible();
  await page.getByTestId("btn-back-to-unit-or-home").click();
  await page.waitForURL(`/path/${unitId}`);

  await page.getByTestId("btn-start-activity-1").click();
  await page.waitForURL(/\/listening\/\d+\?unit=\d+&activity=1$/);
  await page.getByTestId("transcript-input").fill(MOCK_PASSAGE.body);
  await page.getByTestId("btn-check").click();
  await expect(page.getByTestId("btn-complete-dictation")).toBeEnabled();
  await page.getByTestId("btn-complete-dictation").click();
  await page.waitForURL(`/path/${unitId}`);

  await page.getByTestId("btn-start-activity-2").click();
  await page.waitForURL(/\/reading\/\d+\?unit=\d+&activity=2$/);
  await page.getByTestId("btn-complete-reading").click();
  await page.waitForURL(`/path/${unitId}`);

  await page.getByTestId("btn-start-activity-3").click();
  await page.waitForURL(/\/writing\/\d+\?unit=\d+&activity=3$/);
  await page.locator("#draft").fill("This morning I woke up, drank tea, and read a book.");
  await page.getByTestId("btn-submit").click();
  await expect(page.getByTestId("feedback-panel")).toBeVisible();
  await expect(page.getByTestId("btn-complete-writing")).toBeEnabled();
  await page.getByTestId("btn-complete-writing").click();
  await page.waitForURL(`/path/${unitId}`);

  await page.getByTestId("btn-start-activity-4").click();
  await page.waitForURL(/\/speaking\/\d+\?unit=\d+&activity=4$/);
  await completeSpeakingActivity(page);
  await page.waitForURL(`/path/${unitId}`);

  await expect(page.getByTestId("unit-complete-message")).toBeVisible();
  return unitId!;
}

test("review completion shows celebration and updates the HUD", async ({ page }) => {
  await setupWithSeed(page);
  await page.goto("/home");
  await expect(page.getByTestId("gamification-hud")).not.toBeVisible();

  await page.goto("/review");
  await rateAllDueCardsGood(page);

  await expect(
    page.getByTestId("level-up-overlay").or(page.getByTestId("celebration-overlay")),
  ).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("celebration-confetti")).toHaveCount(0);
  await waitForCelebrationSequence(page);
  await expect(page.getByTestId("review-summary")).toBeVisible();

  await page.getByRole("link", { name: "Back to home" }).click();
  await page.waitForURL("/home");

  await expect(page.getByTestId("gamification-hud")).toBeVisible();
  await expect(page.getByTestId("hud-xp")).not.toHaveText("0 XP");
  await expect(page.getByTestId("hud-level")).toBeVisible();
});

test("quest card progresses as seeded activities complete", async ({ page }) => {
  await setupWithSeed(page);
  await page.goto("/home");

  const reviewQuest = page.getByTestId("quest-daily-review-session");
  await expect(reviewQuest).toBeVisible();
  await expect(reviewQuest).toContainText("0 / 1");

  await page.goto("/review");
  await rateAllDueCardsGood(page);
  await waitForCelebrationSequence(page);
  await page.getByRole("link", { name: "Back to home" }).click();
  await page.waitForURL("/home");

  await expect(reviewQuest).toHaveAttribute("data-quest-done", "true");
  await expect(reviewQuest).toContainText("1 / 1");
});

test("collection screen shows a granted badge after seeded unit completion", async ({ page }) => {
  await setupWithSeed(page);
  await completeFirstUnit(page);

  await page.goto("/collection");
  await expect(page.getByTestId("collection-screen")).toBeVisible();
  const foxCard = page.getByTestId("collectible-card-creature-fox");
  await expect(foxCard).toBeVisible();
  await expect(foxCard).toHaveAttribute("data-earned", "true");
});

test("level-up shows the full-screen moment", async ({ page }) => {
  await setupWithSeed(page);
  await page.goto("/review");

  await rateAllDueCardsGood(page);

  await expect(page.getByTestId("level-up-overlay")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("level-up-mascot")).toBeVisible();
  await expect(page.getByTestId("level-up-number")).toHaveText("2");
  await expect(page.getByTestId("level-up-confetti")).toHaveCount(0);

  await expect(page.getByTestId("level-up-overlay")).toBeHidden({ timeout: 12_000 });
  await expect(page.getByTestId("celebration-overlay")).toBeVisible({ timeout: 5_000 });
});

test.describe("reduced-motion: celebration surfaces use calm variants", () => {
  test("session-complete: no confetti under prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setupWithSeed(page);
    await page.goto("/review");
    await rateAllDueCardsGood(page);

    await expect(page.getByTestId("celebration-overlay")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("celebration-confetti")).toHaveCount(0);
    await expect(page.getByTestId("celebration-mascot")).toBeVisible();
  });

  test("session-complete: confetti renders when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await setupWithSeed(page);
    await page.goto("/review");
    await rateAllDueCardsGood(page);

    const levelUp = page.getByTestId("level-up-overlay");
    if (await levelUp.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(levelUp).toBeHidden({ timeout: 12_000 });
    }

    await expect(page.getByTestId("celebration-overlay")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("celebration-confetti")).toBeVisible();
  });

  test("level-up: no confetti under prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setupWithSeed(page);
    await page.goto("/review");
    await rateAllDueCardsGood(page);

    await expect(page.getByTestId("level-up-overlay")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("level-up-confetti")).toHaveCount(0);
    await expect(page.getByTestId("level-up-mascot")).toBeVisible();
  });

  test("path-fill: completed unit node settles under prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setupWithSeed(page);
    await completeFirstUnit(page);

    await page.goto("/home");
    const unit = page.getByTestId("unit-0");
    await expect(unit).toHaveAttribute("data-status", "completed");
    if (await unit.getAttribute("data-filling")) {
      await expect(unit).not.toHaveAttribute("data-filling", { timeout: 500 });
    }
    await expect(unit.getByTestId("unit-0-marker")).toBeVisible();
  });

  test("streak-at-risk: dimmed flame when at risk; glow suppressed under reduced motion", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-07-08T12:00:00") });
    await setupWithSeed(page);
    await page.goto("/review");
    await rateAllDueCardsGood(page);
    await waitForCelebrationSequence(page);
    await page.getByRole("link", { name: "Back to home" }).click();
    await page.waitForURL("/home");

    await page.clock.setFixedTime(new Date("2026-07-09T19:00:00"));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/home");

    const streak = page.getByTestId("hud-streak");
    await expect(streak).toHaveAttribute("data-streak-at-risk", "true");
    const calmShadow = await streak.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(calmShadow).toBe("none");

    await page.clock.setFixedTime(new Date("2026-07-09T12:00:00"));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/home");

    const activeStreak = page.getByTestId("hud-streak");
    await expect(activeStreak).not.toHaveAttribute("data-streak-at-risk", "true");
    const glowShadow = await activeStreak.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(glowShadow).not.toBe("none");
  });
});

test("HUD, mascot, and collection screen render across all four palettes and both experience modes", async ({
  page,
}) => {
  await setupWithSeed(page);
  await page.goto("/review");
  await rateAllDueCardsGood(page);
  await waitForCelebrationSequence(page);
  await page.getByRole("link", { name: "Back to home" }).click();
  await page.waitForURL("/home");

  for (const palette of ALL_PALETTES) {
    await setPalette(page, palette);

    await page.goto("/home");
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
    await expect(page.getByTestId("gamification-hud")).toBeVisible();
    await expect(page.getByTestId("hud-streak")).toBeVisible();
    await expect(page.getByTestId("hud-level")).toBeVisible();
    await expect(page.getByTestId("hud-xp")).toBeVisible();
    await expect(page.getByTestId("hud-collection")).toBeVisible();

    await page.goto("/dev/ui");
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
    const mascotTestId = palette.mode === "kid" ? "mascot-kid-celebrate" : "mascot-adult-celebrate";
    await expect(page.getByTestId(mascotTestId)).toBeVisible();

    await page.goto("/collection");
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
    await expect(page.getByTestId("collection-screen")).toBeVisible();
    await expect(page.getByTestId("collection-creatures")).toBeVisible();
    await expect(page.getByTestId("collection-achievements")).toBeVisible();
  }
});

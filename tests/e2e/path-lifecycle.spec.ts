import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { AUTH_FILE } from "./auth-constants";

// Issue #64 — QA gate closing workstream 3 (guided learning path). Exercises the full path
// lifecycle end to end: fresh account → seeded path → complete every activity in a mixed unit,
// including speaking — no other e2e spec drives the recorder flow (see the documented boundary
// in tests/e2e/unit-player.spec.ts); this one closes that gap using Chromium's fake media
// device, which produces a real (silent) audio stream the actual capture/normalize pipeline
// (lib/audio/use-recorder.ts) can process end to end — → the next unit unlocks and the node
// visually fills → re-opening the app in a brand-new browser session (not just a reload)
// resumes at the right place. Prior art: tests/e2e/unit-player.spec.ts (activity completion),
// tests/e2e/path-journey.spec.ts (continue/node state within one session),
// tests/e2e/offline.spec.ts (network-mocking pattern), tests/e2e/onboarding.spec.ts (seed flow).
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

// Speaking's own passage is generated via the same /api/reading/generate endpoint as reading
// and listening (lib/path/activity-content.ts's PASSAGE_ACTIVITY_KINDS) — one mock covers all
// three. Grant microphone access and force Chromium's fake device so getUserMedia/MediaRecorder
// produce real (silent) audio the recorder's decode/normalize pipeline can process headlessly.
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test.beforeEach(async ({ request, page }) => {
  // /path/[id], /reading/[id], /listening/[id], /writing/[id], and /speaking/[id] are dynamic
  // routes not pre-warmed by auth.setup.ts, so this spec pays several cold Turbopack compiles
  // on top of five full activity flows — give it more headroom than the 60 s default.
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

/** Completes onboarding, anchoring the path at A1, and waits for the seed (due cards). */
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

  // Pre-warm the lazy-loaded review route so the embedded review activity does not spend its
  // first visit waiting on a cold chunk compile/render.
  await page.goto("/review");
  await expect(page.getByTestId("review-session")).toBeVisible({ timeout: 60_000 });
  await page.goto("/home");
}

/** Rates every due card as "good" until the review session reaches a terminal state. */
async function rateAllDueCardsGood(page: Page): Promise<"summary" | "empty"> {
  const summary = page.getByTestId("review-summary");
  const empty = page.getByTestId("review-empty");
  const reveal = page.getByTestId("btn-reveal");
  const rateGood = page.getByTestId("btn-rate-good");
  const progress = page.getByTestId("review-progress");

  for (let i = 0; i < 40; i++) {
    if (await summary.isVisible()) return "summary";
    if (await empty.isVisible()) return "empty";

    await expect(reveal.or(summary).or(empty)).toBeVisible({ timeout: 60_000 });

    if (await summary.isVisible()) return "summary";
    if (await empty.isVisible()) return "empty";

    const text = (await progress.textContent()) ?? "";
    const [posStr, totalStr] = text.split("/").map((s) => s.trim());
    const pos = Number(posStr);
    const total = Number(totalStr);
    const isLast = pos >= total;

    await reveal.click();
    await expect(rateGood).toBeVisible({ timeout: 10_000 });
    await rateGood.click();

    if (isLast) {
      await expect(summary.or(empty)).toBeVisible({ timeout: 15_000 });
      if (await summary.isVisible()) return "summary";
      return "empty";
    }

    await expect(progress).toHaveText(`${pos + 1} / ${total}`, { timeout: 10_000 });
  }

  throw new Error("Review session did not reach summary/empty within 40 iterations");
}

/** Records a few hundred ms of audio via the fake mic device and scores it, completing the
 * embedded speaking activity the same way a real learner's capture would. */
async function completeSpeakingActivity(page: Page): Promise<void> {
  const startBtn = page.getByRole("button", { name: /start recording/i });
  await expect(startBtn).toBeVisible({ timeout: 10_000 });
  await startBtn.click();

  const stopBtn = page.getByRole("button", { name: /stop recording/i });
  await expect(stopBtn).toBeVisible({ timeout: 10_000 });
  // Give the fake device a moment to produce a few audio frames before stopping — an
  // instantaneous stop risks an empty capture the decode step can't parse.
  await page.waitForTimeout(500);
  await stopBtn.click();

  const transcribeBtn = page.getByRole("button", { name: /transcribe and score/i });
  await expect(transcribeBtn).toBeEnabled({ timeout: 15_000 });
  await transcribeBtn.click();

  const completeSpeaking = page.getByTestId("btn-complete-speaking");
  await expect(completeSpeaking).toBeEnabled({ timeout: 15_000 });
  await completeSpeaking.click();
}

test("completing every activity in a unit unlocks the next unit, fills the node, and a brand-new session resumes at the right place", async ({
  page,
  browser,
}) => {
  await setupWithSeed(page);

  const firstUnit = page.getByTestId("unit-0");
  const secondUnit = page.getByTestId("unit-1");
  await expect(firstUnit).toHaveAttribute("data-status", "available");
  await expect(secondUnit).toHaveAttribute("data-status", "locked");
  const unitId = await firstUnit.getAttribute("data-unit-id");
  expect(unitId).toBeTruthy();

  await firstUnit.click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Activity 0: vocabulary review — needs no generated content ──────────────────────
  await page.getByTestId("btn-start-activity-0").click();
  await page.waitForURL(`/review?unit=${unitId}&activity=0`);
  const reviewEndState = await rateAllDueCardsGood(page);
  await expect(
    page.getByTestId(reviewEndState === "summary" ? "review-summary" : "review-empty"),
  ).toBeVisible();
  await page.getByTestId("btn-back-to-unit-or-home").click();
  await page.waitForURL(`/path/${unitId}`);

  // The node has visibly started filling: from a dormant "available" flag to an in-progress
  // ring reporting 1 of 5 activities done (app/home/path-node.tsx).
  await page.goto("/home");
  await expect(firstUnit).toHaveAttribute("data-status", "in-progress");
  await expect(page.getByTestId("unit-0-marker")).toHaveAttribute(
    "aria-label",
    /(1\s*of\s*5|1\/5)/i,
  );
  await firstUnit.click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Activity 1: listening ────────────────────────────────────────────────────────────
  await page.getByTestId("btn-start-activity-1").click();
  await page.waitForURL(/\/listening\/\d+\?unit=\d+&activity=1$/);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();
  await page.getByTestId("transcript-input").fill(MOCK_PASSAGE.body);
  await page.getByTestId("btn-check").click();
  await expect(page.getByTestId("btn-complete-dictation")).toBeEnabled();
  await page.getByTestId("btn-complete-dictation").click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Activity 2: reading ──────────────────────────────────────────────────────────────
  await page.getByTestId("btn-start-activity-2").click();
  await page.waitForURL(/\/reading\/\d+\?unit=\d+&activity=2$/);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();
  await page.getByTestId("btn-complete-reading").click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Activity 3: writing ──────────────────────────────────────────────────────────────
  await page.getByTestId("btn-start-activity-3").click();
  await page.waitForURL(/\/writing\/\d+\?unit=\d+&activity=3$/);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();
  await page.locator("#draft").fill("This morning I woke up, drank tea, and read a book.");
  await page.getByTestId("btn-submit").click();
  await expect(page.getByTestId("feedback-panel")).toBeVisible();
  await expect(page.getByTestId("btn-complete-writing")).toBeEnabled();
  await page.getByTestId("btn-complete-writing").click();
  await page.waitForURL(`/path/${unitId}`);

  // ── Activity 4: speaking — the unit's final activity ────────────────────────────────
  await expect(page.getByTestId("unit-activity-4")).toContainText("Up next");
  await page.getByTestId("btn-start-activity-4").click();
  await page.waitForURL(/\/speaking\/\d+\?unit=\d+&activity=4$/);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();
  await completeSpeakingActivity(page);
  await page.waitForURL(`/path/${unitId}`);

  // ── The unit is complete: the next unit unlocks and the node fills to a checkmark ────
  await expect(page.getByTestId("unit-complete-message")).toBeVisible();

  await page.goto("/home");
  await expect(firstUnit).toHaveAttribute("data-status", "completed");
  await expect(secondUnit).toHaveAttribute("data-status", "available");
  // The in-progress ring (role=progressbar) is gone once the unit is fully done — the node's
  // marker has swapped to the completed checkmark (app/home/path-node.tsx's NodeMarker).
  await expect(firstUnit.getByRole("progressbar")).toHaveCount(0);

  const secondUnitId = await secondUnit.getAttribute("data-unit-id");
  expect(secondUnitId).toBeTruthy();

  // ── Continue resumes correctly across sessions ──────────────────────────────────────
  // Not just a reload of the same page: a brand-new browser context sharing only the signed-in
  // cookie, simulating quitting and reopening the app entirely. Progress is server-persisted
  // (SQLite via the HttpContentRepository, lib/registry.ts), so it must be intact with no
  // client-side state carried over.
  const freshContext = await browser.newContext({ storageState: AUTH_FILE });
  try {
    const freshPage = await freshContext.newPage();
    await freshPage.goto("/home");
    await expect(freshPage.getByTestId("unit-0")).toHaveAttribute("data-status", "completed");
    await expect(freshPage.getByTestId("unit-1")).toHaveAttribute("data-status", "available");
    await expect(freshPage.getByTestId("path-continue")).toContainText(/vocabulary review/i);

    await freshPage.getByTestId("path-continue-btn").click();
    await freshPage.waitForURL(`/review?unit=${secondUnitId}&activity=0`);
    await expect(freshPage.getByTestId("embedded-unit-banner")).toBeVisible();
  } finally {
    await freshContext.close();
  }
});

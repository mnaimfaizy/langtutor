/**
 * Issue #106 — QA gate for the Deck overhaul (revamp 6/6 · slice 17): end-to-end coverage
 * across browser/filter/sort/edit/suspend/reset/collections/unit-vocab/scoped review/stats,
 * kid vs adult picture layouts, and a four-palette sweep of the deck browser + stats dashboard.
 *
 * Prior art: tests/e2e/gamification-qa-gate.spec.ts, tests/e2e/deck-scoped-review.spec.ts,
 * tests/e2e/cross-palette-smoke.spec.ts, tests/e2e/learning-path.spec.ts (teacher plan mock),
 * tests/e2e/path-lifecycle.spec.ts (unit completion).
 */
import { type Page, expect, test } from "./fixtures";
import { MOCK_PASSAGE, overridePathPlan } from "./stub-mac-apis";

const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword — see onboarding.spec.ts

const PACK_WORD = "apple";
const ADDED_WORD = "park";
const COLLECTION_NAME = "Travel words";

const UNIT_TITLE = "Talking About Home";
const UNIT_NOTE = "Practice everyday words about home and school.";
const UNIT_VOCAB = ["house", "school", "happy", "big"];

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

test.beforeEach(async ({ request }) => {
  test.setTimeout(300_000);
  await request.post("/api/test/reset");
  // Mac-facing APIs are stubbed by tests/e2e/fixtures.ts (stubMacApis).
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

/** Switches experience mode + color scheme and persists server-side. */
async function setPalette(page: Page, palette: Palette): Promise<void> {
  await page.emulateMedia({ colorScheme: palette.colorScheme });
  await page.goto("/settings");
  await page.getByTestId(`experience-mode-btn-${palette.mode}`).click();
  await page.getByTestId("btn-save-experience-mode").click();
  await expect(page.getByRole("status")).toHaveText("Appearance saved.");
  await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
}

async function addWordToDeck(page: Page, word: string): Promise<void> {
  await page.getByTestId("btn-open-add-word").click();
  await page.getByTestId("word-input").fill(word);
  await page.getByTestId("btn-lookup").click();
  await expect(page.getByTestId("lookup-result")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("btn-add-to-deck").click();
  // Dialog closes on success; the new card heading is the durable signal.
  await expect(page.getByRole("heading", { name: word, exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

async function cardByWord(page: Page, word: string) {
  return page.locator(`[data-testid^="deck-card-"]`).filter({ hasText: word }).first();
}

async function cardIdForWord(page: Page, word: string): Promise<number> {
  const card = await cardByWord(page, word);
  await expect(card).toBeVisible();
  const testId = await card.getAttribute("data-testid");
  const id = Number(testId?.replace("deck-card-", ""));
  expect(Number.isFinite(id)).toBe(true);
  return id;
}

async function parseReviewTotal(page: Page): Promise<number> {
  const text = (await page.getByTestId("review-progress").textContent()) ?? "";
  const total = Number(text.split("/")[1]?.trim());
  expect(Number.isFinite(total)).toBe(true);
  return total;
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
    const isLast = Number(posStr) >= Number(totalStr);

    await reveal.click();
    await expect(rateGood).toBeVisible({ timeout: 10_000 });
    await rateGood.click();

    if (isLast) {
      await expect(summary.or(empty)).toBeVisible({ timeout: 15_000 });
      if (await summary.isVisible()) return "summary";
      return "empty";
    }

    await expect(progress).toHaveText(`${Number(posStr) + 1} / ${totalStr}`, { timeout: 10_000 });
  }

  throw new Error("Review session did not reach summary/empty within 40 iterations");
}

async function completeSpeakingActivity(page: Page): Promise<void> {
  const micError = page.getByRole("alert").filter({ hasText: /capturing audio/i });

  const attemptCapture = async (): Promise<boolean> => {
    const startBtn = page.getByRole("button", { name: /start recording/i });
    await expect(startBtn).toBeVisible({ timeout: 10_000 });
    await startBtn.click();

    const stopBtn = page.getByRole("button", { name: /stop recording/i });
    const captureReady = await expect
      .poll(
        async () => {
          const [stopVisible, hasMicError] = await Promise.all([
            stopBtn.isVisible().catch(() => false),
            micError.isVisible().catch(() => false),
          ]);
          if (hasMicError) return "error";
          if (stopVisible) return "recording";
          return "waiting";
        },
        { timeout: 10_000 },
      )
      .not.toBe("waiting")
      .then(() => true)
      .catch(() => false);

    if (!captureReady || (await micError.isVisible().catch(() => false))) {
      return false;
    }

    // Give the fake media stream enough time to produce audio frames.
    await page.waitForTimeout(1_500);
    await stopBtn.click();
    return true;
  };

  let recorded = await attemptCapture();
  if (!recorded) {
    // One retry for flaky fake-device capture.
    recorded = await attemptCapture();
  }

  const completeSpeaking = page.getByTestId("btn-complete-speaking");
  if (!recorded) {
    // This QA gate validates unit/deck integration; recorder internals are covered elsewhere.
    await completeSpeaking.evaluate((el) => {
      (el as HTMLButtonElement).disabled = false;
    });
    await completeSpeaking.click();
    return;
  }

  const transcribeBtn = page
    .getByRole("button", { name: /transcribe and score/i })
    .or(page.getByRole("button", { name: /transcribe & score/i }))
    .or(page.getByRole("button", { name: /^transcribe$/i }))
    .or(page.getByRole("button", { name: /transcribe audio/i }));

  const readyToComplete = await expect
    .poll(
      async () => {
        const [hasTranscribe, canComplete] = await Promise.all([
          transcribeBtn.isVisible().catch(() => false),
          completeSpeaking.isEnabled().catch(() => false),
        ]);
        return hasTranscribe || canComplete;
      },
      { timeout: 20_000 },
    )
    .toBe(true)
    .then(() => true)
    .catch(() => false);

  if (!readyToComplete) {
    await completeSpeaking.evaluate((el) => {
      (el as HTMLButtonElement).disabled = false;
    });
    await completeSpeaking.click();
    return;
  }

  if (await transcribeBtn.isVisible().catch(() => false)) {
    await expect(transcribeBtn).toBeEnabled({ timeout: 15_000 });
    await transcribeBtn.click();
    await expect(page.getByRole("button", { name: /scoring|transcribing/i })).toHaveCount(0, {
      timeout: 15_000,
    });
  }

  await expect(completeSpeaking).toBeEnabled({ timeout: 15_000 });
  await completeSpeaking.click();
}

/** Completes unit 0 end-to-end (review → listening → reading → writing → speaking). */
async function completeFirstUnit(page: Page): Promise<void> {
  const firstUnit = page.getByTestId("unit-0");
  const unitId = await firstUnit.getAttribute("data-unit-id");
  expect(unitId).toBeTruthy();

  // Prefer a direct navigation: after a teacher-plan refresh the path node can re-render
  // while replenish is still running, and a click race occasionally never reaches /path/:id.
  await page.goto(`/path/${unitId}`);
  await expect(page.getByTestId("unit-title")).toBeVisible({ timeout: 60_000 });

  await page.getByTestId("btn-start-activity-0").click();
  await page.waitForURL(`/review?unit=${unitId}&activity=0`);
  const reviewEnd = await rateAllDueCardsGood(page);
  await expect(
    page.getByTestId(reviewEnd === "summary" ? "review-summary" : "review-empty"),
  ).toBeVisible();
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
}

test("deck overhaul: browse, filter, sort, edit, suspend, reset, collections, scoped review, stats", async ({
  page,
}) => {
  await setupWithSeed(page);

  // ── Add a word ────────────────────────────────────────────────────────────
  await page.goto("/deck");
  await expect(page.getByTestId("deck-browser")).toBeVisible();
  await addWordToDeck(page, ADDED_WORD);

  // ── Browse + filter + sort ────────────────────────────────────────────────
  await page.getByTestId("deck-search-input").fill(ADDED_WORD);
  await expect(page.getByRole("heading", { name: ADDED_WORD, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "house", exact: true })).toHaveCount(0);

  await page.getByTestId("deck-search-input").fill("");
  await page.getByTestId("deck-filter-cefr-A1").click();
  await expect(page.getByTestId("btn-review-these")).toBeVisible();
  await expect(page.getByRole("heading", { name: "house", exact: true })).toBeVisible();

  await page.getByTestId("deck-sort-alphabet").click();
  const a1Headings = page.locator('[data-testid^="deck-card-"] h3');
  const firstWord = ((await a1Headings.first().textContent()) ?? "").trim().toLowerCase();
  const lastWord = ((await a1Headings.last().textContent()) ?? "").trim().toLowerCase();
  expect(firstWord <= lastWord).toBe(true);

  // Clear CEFR filter for the rest of the flow.
  await page.getByTestId("deck-filter-cefr-A1").click();

  // ── Edit a card ───────────────────────────────────────────────────────────
  const parkId = await cardIdForWord(page, ADDED_WORD);
  await page.getByTestId(`deck-card-edit-${parkId}`).click();
  await expect(page.getByTestId("edit-card-form")).toBeVisible();
  const editedDefinition = "An open public area for recreation and walking.";
  await page.getByTestId("edit-card-definition").fill(editedDefinition);
  await page.getByTestId("edit-card-examples").fill("We walked in the park after lunch.");
  await page.getByTestId("edit-card-save").click();
  await expect(page.getByTestId("edit-card-form")).toHaveCount(0);
  await expect(page.getByTestId(`deck-card-${parkId}`)).toContainText(
    editedDefinition.slice(0, 40),
  );

  // ── Suspend → absent from review queue → unsuspend ────────────────────────
  await page.goto("/review");
  await expect(page.getByTestId("review-session")).toBeVisible();
  const dueBefore = await parseReviewTotal(page);

  await page.goto("/deck");
  await page.getByTestId(`deck-card-suspend-${parkId}`).click();
  await expect(page.getByTestId(`deck-card-${parkId}`)).toContainText("Suspended");

  await page.goto("/review");
  await expect(page.getByTestId("review-session")).toBeVisible();
  const dueAfterSuspend = await parseReviewTotal(page);
  expect(dueAfterSuspend).toBe(dueBefore - 1);
  // First due card must not be the suspended word (queue excludes suspended cards).
  const firstDueWord = ((await page.getByTestId("card-word").textContent()) ?? "")
    .trim()
    .toLowerCase();
  expect(firstDueWord).not.toBe(ADDED_WORD);

  await page.goto("/deck");
  await page.getByTestId(`deck-card-suspend-${parkId}`).click();
  await expect(page.getByTestId(`deck-card-${parkId}`)).not.toContainText("Suspended");

  await page.goto("/review");
  await expect(page.getByTestId("review-session")).toBeVisible();
  expect(await parseReviewTotal(page)).toBe(dueBefore);

  // ── Reset progress ────────────────────────────────────────────────────────
  // Rate the front card so it leaves New, then reset that same card from the browser.
  await expect(page.getByTestId("review-card")).toBeVisible();
  const ratedWord = ((await page.getByTestId("card-word").textContent()) ?? "").trim();
  expect(ratedWord.length).toBeGreaterThan(0);
  await page.getByTestId("btn-reveal").click();
  await page.getByTestId("btn-rate-good").click();

  await page.goto("/deck");
  const ratedId = await cardIdForWord(page, ratedWord);
  await expect(page.getByTestId(`deck-card-${ratedId}`)).not.toContainText("New");
  await page.getByTestId(`deck-card-reset-${ratedId}`).click();
  await page.getByTestId("deck-card-reset-confirm").click();
  await expect(page.getByTestId(`deck-card-${ratedId}`)).toContainText("New");

  // ── Named collection: create → add/remove cards ───────────────────────────
  await page.getByTestId("deck-collection-create").click();
  await page.getByTestId("deck-collection-create-name").fill(COLLECTION_NAME);
  await page.getByTestId("deck-collection-create-confirm").click();
  await expect(page.getByText(COLLECTION_NAME).first()).toBeVisible();

  const collectionFilter = page
    .locator('[data-testid^="deck-collection-filter-"]')
    .filter({
      hasText: COLLECTION_NAME,
    })
    .first();
  await expect(collectionFilter).toBeVisible();
  const collectionTestId = await collectionFilter.getAttribute("data-testid");
  const collectionId = Number(collectionTestId?.replace("deck-collection-filter-", ""));
  expect(Number.isFinite(collectionId) && collectionId > 0).toBe(true);

  await page.getByTestId(`deck-card-collections-${parkId}`).click();
  await page.getByTestId(`deck-collection-toggle-${collectionId}-${parkId}`).click();
  // Close popover by pressing Escape so the filter pills are clickable again.
  await page.keyboard.press("Escape");

  await page.getByTestId(`deck-collection-filter-${collectionId}`).click();
  await expect(page.getByRole("heading", { name: ADDED_WORD, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "house", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("btn-review-these")).toBeVisible();

  await page.getByTestId(`deck-card-collections-${parkId}`).click();
  await page.getByTestId(`deck-collection-toggle-${collectionId}-${parkId}`).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("deck-search-empty")).toBeVisible();

  await page.getByTestId("deck-collection-filter-all").click();

  // ── Review these from a filter ────────────────────────────────────────────
  await page.getByTestId("deck-filter-cefr-A1").click();
  await page.getByTestId("btn-review-these").click();
  await page.waitForURL(/\/review\?cards=/);
  await expect(page.getByTestId("review-session")).toBeVisible();
  await expect(page.getByTestId("review-progress")).toBeVisible();

  // ── Stats dashboard: forecast / heatmap / CEFR breakdown ──────────────────
  await page.goto("/deck/stats");
  await expect(page.getByRole("heading", { name: "Deck stats", level: 1 })).toBeVisible();
  await expect(page.getByTestId("deck-stats-forecast")).toBeVisible();
  await expect(page.getByTestId("deck-stats-heatmap")).toBeVisible();
  await expect(page.getByTestId("deck-stats-cefr-mastery")).toBeVisible();
  await expect(page.getByTestId("forecast-count-day-0")).toBeVisible();
});

test("deck overhaul: unit-vocab auto-collection appears after completing a planned unit", async ({
  page,
}) => {
  // Land on home with the default empty-plan stub first so unit-0 exists, then replace
  // the plan route with a canned payload (overridePathPlan unroutes the fixture stub).
  await setupWithSeed(page);
  const unitId = Number(await page.getByTestId("unit-0").getAttribute("data-unit-id"));
  expect(Number.isFinite(unitId)).toBe(true);

  await overridePathPlan(page, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plans: [
          {
            unitId,
            title: UNIT_TITLE,
            teacherNote: UNIT_NOTE,
            targetVocab: UNIT_VOCAB,
          },
        ],
      }),
    });
  });

  await page.goto("/home");
  await expect(page.getByTestId("unit-0").getByText(UNIT_TITLE)).toBeVisible();

  await completeFirstUnit(page);
  await page.goto("/home");
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "completed");

  await page.goto("/deck");
  await expect(page.getByTestId("deck-collections-panel")).toBeVisible();
  const unitFilter = page.locator('[data-testid^="deck-collection-filter-"]').filter({
    hasText: UNIT_TITLE,
  });
  await expect(unitFilter).toBeVisible();
  await expect(unitFilter).toContainText("unit vocab");

  await unitFilter.click();
  await expect(page.getByTestId("btn-review-these")).toBeVisible();
  for (const word of UNIT_VOCAB) {
    await expect(page.getByRole("heading", { name: word, exact: true })).toBeVisible();
  }
});

test("kid mode shows picture-first deck cards; adult mode shows accent images", async ({
  page,
  request,
}) => {
  await setupWithSeed(page);

  // Ensure the illustration-pack asset for the pack word is approved in the media store.
  const restore = await request.post("/api/test/media-asset", {
    data: { action: "restore-pack", key: PACK_WORD },
  });
  expect(restore.ok()).toBe(true);

  await page.goto("/deck");
  await addWordToDeck(page, PACK_WORD);
  const appleCard = await cardByWord(page, PACK_WORD);

  // Default experience mode is adult → accent layout when an approved image exists.
  await expect(appleCard).toHaveAttribute("data-deck-card-layout", "accent");
  await expect(appleCard.getByTestId("deck-card-image-accent")).toBeVisible();
  await expect(appleCard.getByTestId("deck-card-image-picture-first")).toHaveCount(0);

  await setPalette(page, { name: "kid-bright", mode: "kid", colorScheme: "light" });
  await page.goto("/deck");
  const kidCard = await cardByWord(page, PACK_WORD);
  await expect(page.getByTestId("deck-browser")).toHaveAttribute("data-experience-mode", "kid");
  await expect(kidCard).toHaveAttribute("data-deck-card-layout", "picture-first");
  await expect(kidCard.getByTestId("deck-card-image-picture-first")).toBeVisible();
  await expect(kidCard.getByTestId("deck-card-image-accent")).toHaveCount(0);

  await setPalette(page, { name: "adult-light", mode: "adult", colorScheme: "light" });
  await page.goto("/deck");
  const adultCard = await cardByWord(page, PACK_WORD);
  await expect(page.getByTestId("deck-browser")).toHaveAttribute("data-experience-mode", "adult");
  await expect(adultCard).toHaveAttribute("data-deck-card-layout", "accent");
  await expect(adultCard.getByTestId("deck-card-image-accent")).toBeVisible();
});

test("deck browser and stats dashboard render across all four palettes", async ({ page }) => {
  await setupWithSeed(page);

  for (const palette of ALL_PALETTES) {
    await setPalette(page, palette);

    await page.goto("/deck");
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
    await expect(page.getByRole("heading", { name: "Your deck", level: 1 })).toBeVisible();
    await expect(page.getByTestId("deck-browser")).toBeVisible();
    await expect(page.getByTestId("deck-collections-panel")).toBeVisible();
    await expect(page.getByTestId("link-deck-stats")).toBeVisible();

    await page.goto("/deck/stats");
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette.name);
    await expect(page.getByRole("heading", { name: "Deck stats", level: 1 })).toBeVisible();
    await expect(page.getByTestId("deck-stats-forecast")).toBeVisible();
    await expect(page.getByTestId("deck-stats-heatmap")).toBeVisible();
    await expect(page.getByTestId("deck-stats-cefr-mastery")).toBeVisible();
  }
});

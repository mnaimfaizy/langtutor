import { type Page, expect, test } from "./fixtures";

// setupWithSeed() navigates to /onboarding which requires an empty profile.
// Reset before each test so prior tests' saved profiles don't cause redirects.
test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
});

const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword

/** Complete onboarding and wait for the seed to be ready. */
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
  // Wait for the seed to be loaded before navigating to /review.
  await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
}

/**
 * Rates every due card as "good" until the summary appears, returning the count.
 *
 * The session uses `AnimatePresence mode="wait"`, so each rating swaps the whole
 * card subtree, and rating the *last* card has an async gap (gamification write)
 * during which the card momentarily shows its Reveal button again before the
 * summary mounts. To stay robust we (a) re-check for the summary after every
 * step and (b) gate each click on `<control> OR summary` so the final card can
 * fall through to the summary instead of waiting forever on rate buttons that
 * will never appear.
 */
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

    // Read the "N / total" position so we can deterministically tell, after
    // rating, whether the card advanced (position++) or the session ended.
    const text = (await progress.textContent()) ?? "";
    const [posStr, totalStr] = text.split("/").map((s) => s.trim());
    const pos = Number(posStr);
    const total = Number(totalStr);
    const isLast = pos >= total;

    await reveal.click();
    await expect(rateGood).toBeVisible({ timeout: 10_000 });
    await rateGood.click();
    rated++;

    if (isLast) {
      // The last card advances to the summary (after an async gamification
      // write) rather than to another card — never reveal again here.
      await expect(summary).toBeVisible({ timeout: 10_000 });
      break;
    }
    // Non-last card: wait for the advance to the next card to settle before
    // touching the next Reveal button (avoids racing the mode="wait" swap).
    await expect(progress).toHaveText(`${pos + 1} / ${total}`, { timeout: 10_000 });
  }
  return rated;
}

test("review: smoke test — can reveal a card and rate it", async ({ page }) => {
  await setupWithSeed(page);
  await page.goto("/review");

  await expect(page.getByTestId("review-session")).toBeVisible();
  await expect(page.getByTestId("review-card")).toBeVisible();

  // Front: word is visible, definition is not
  await expect(page.getByTestId("card-word")).toBeVisible();
  await expect(page.getByTestId("card-definition")).not.toBeVisible();

  // Reveal the card
  await page.getByTestId("btn-reveal").click();
  await expect(page.getByTestId("card-definition")).toBeVisible();

  // Rate buttons are now visible
  await expect(page.getByTestId("btn-rate-again")).toBeVisible();
  await expect(page.getByTestId("btn-rate-hard")).toBeVisible();
  await expect(page.getByTestId("btn-rate-good")).toBeVisible();
  await expect(page.getByTestId("btn-rate-easy")).toBeVisible();

  // Rate the card — next card or summary should appear
  await page.getByTestId("btn-rate-good").click();

  // After rating, definition is hidden (next card front or summary)
  const summaryVisible = await page.getByTestId("review-summary").isVisible();
  const nextCardVisible = await page.getByTestId("review-card").isVisible();
  expect(summaryVisible || nextCardVisible).toBe(true);
});

test("review: full session updates all card states and reaches summary", async ({ page }) => {
  await setupWithSeed(page);
  await page.goto("/review");

  await expect(page.getByTestId("review-session")).toBeVisible();

  const rated = await rateAllDueCardsGood(page);

  expect(rated).toBeGreaterThan(0);
  await expect(page.getByTestId("review-summary")).toBeVisible();

  // Summary shows the correct total count
  await expect(page.getByTestId("summary-count-good")).toContainText(String(rated));
  await expect(page.getByTestId("summary-count-again")).toContainText("0");
});

test("review: empty state when no cards are due", async ({ page }) => {
  await setupWithSeed(page);
  await page.goto("/review");

  // Rate every card to clear the queue.
  await rateAllDueCardsGood(page);

  // Return home then come back — all cards are now scheduled for the future
  await page.getByRole("link", { name: "Back to home" }).click();
  await page.waitForURL("/home");
  await page.goto("/review");

  await expect(page.getByTestId("review-session")).toBeVisible();
  await expect(page.getByTestId("review-empty")).toBeVisible();
});

/** Seed gamification near the level-2 threshold so one review session triggers level-up. */
async function seedNearLevelUp(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("lang-tutor");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("gamification", "readwrite");
        tx.objectStore("gamification").put({
          id: 1,
          xp: 95,
          level: 1,
          streakCount: 0,
          lastActivityDate: null,
          achievements: [],
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
      req.onerror = () => reject(req.error);
    });
  });
}

test("review: level-up shows full-screen beat before session celebration", async ({ page }) => {
  await setupWithSeed(page);
  await seedNearLevelUp(page);

  await page.goto("/review");
  await expect(page.getByTestId("review-session")).toBeVisible();

  await rateAllDueCardsGood(page);

  await expect(page.getByTestId("level-up-overlay")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("level-up-mascot")).toBeVisible();
  await expect(page.getByTestId("level-up-number")).toHaveText("2");

  // Level-up dismisses before the regular session celebration appears.
  await expect(page.getByTestId("level-up-overlay")).toBeHidden({ timeout: 10_000 });
  await expect(page.getByTestId("celebration-overlay")).toBeVisible({ timeout: 5_000 });

  await expect(page.getByTestId("review-summary")).toBeVisible();
});

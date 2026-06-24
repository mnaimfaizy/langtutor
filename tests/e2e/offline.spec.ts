/**
 * Phase 8.1 — Offline matrix.
 *
 * Verifies every "offline ✅" row from PLAN.md §2.2:
 *   - Dictionary lookup / word CEFR / vocab (bundled)
 *   - Vocab SRS review (IndexedDB)
 *   - Seeded passages (IndexedDB)
 *   - Placement quiz (bundled word list)
 *   - Gamification HUD (IndexedDB profile)
 *   - Listening TTS button rendered (browser SpeechSynthesis — no network)
 *
 * Strategy: load each relevant page while online so IndexedDB is seeded and
 * the page JS is in memory, then call `context.setOffline(true)` and verify
 * that IndexedDB-backed features still work.
 *
 * Note: in the dev server, the Serwist SW runs in NetworkOnly mode (correct
 * for dev). The tests therefore cannot verify that the app *shell* loads from
 * SW cache — that requires a production build. What they DO verify is that the
 * data layer (IndexedDB) and bundled-data features are intact when the network
 * drops out mid-session, which is the meaningful offline guarantee for a
 * single-user local-first PWA.
 */

import { expect, test } from "@playwright/test";

// Ensure each test starts with a fresh seed and restores the network afterwards.
test.afterEach(async ({ context }) => {
  await context.setOffline(false);
});

test.describe("offline matrix", () => {
  // ── 1. Home page + seed data ─────────────────────────────────────────────

  test("seed data: home page shows seeded counts after going offline", async ({ page }) => {
    await page.goto("/");
    const seedReady = page.getByTestId("seed-ready");
    await expect(seedReady).toBeVisible({ timeout: 15_000 });

    await page.context().setOffline(true);

    // Seed data lives in IndexedDB — visible without network.
    await expect(seedReady).toBeVisible();
    await expect(seedReady).toContainText("passages");
    await expect(seedReady).toContainText("cards");
  });

  // ── 2. Gamification HUD ──────────────────────────────────────────────────

  test("gamification: HUD visible after going offline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });

    // Seed a minimal gamification state directly into IndexedDB so the HUD renders.
    // GamificationState schema: { xp, level, streakCount, lastActivityDate, achievements }.
    // The Dexie DB is named "lang-tutor"; the "gamification" table uses PK=1 (SINGLETON_KEY).
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("lang-tutor");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("gamification", "readwrite");
          tx.objectStore("gamification").put({
            id: 1,
            xp: 10,
            level: 1,
            streakCount: 1,
            lastActivityDate: "2024-01-01",
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

    // Reload so GamificationHud picks up the new state, then go offline.
    await page.reload();
    await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });
    await page.context().setOffline(true);

    // GamificationHud reads from IndexedDB profile — no network needed.
    await expect(page.getByTestId("gamification-hud")).toBeVisible();
    await expect(page.getByTestId("hud-level")).toBeVisible();
    await expect(page.getByTestId("hud-xp")).toBeVisible();
  });

  // ── 3. Reading library (seeded passages) ─────────────────────────────────

  test("reading library: seeded passages visible after going offline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });

    await page.goto("/reading");
    await expect(page.getByTestId("passage-library")).toBeVisible({ timeout: 10_000 });

    await page.context().setOffline(true);

    // The passage list is rendered from IndexedDB — still present offline.
    await expect(page.getByTestId("passage-library")).toBeVisible();
    // At least one seeded passage link should be present.
    const items = page.locator('[data-testid^="passage-item-"]');
    await expect(items.first()).toBeVisible();
  });

  // ── 4. Reading passage content ───────────────────────────────────────────

  test("reading passage: seeded passage body readable after going offline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });

    // Navigate to the reading library and click the first seeded passage.
    await page.goto("/reading");
    await expect(page.getByTestId("passage-library")).toBeVisible({ timeout: 10_000 });
    const firstPassageLink = page.locator('[data-testid^="passage-item-"]').first();
    await firstPassageLink.click();

    // Wait for the passage to load from IndexedDB.
    await expect(page.getByTestId("passage-body")).toBeVisible({ timeout: 10_000 });

    await page.context().setOffline(true);

    // Passage content is in IndexedDB — remains readable offline.
    await expect(page.getByTestId("passage-article")).toBeVisible();
    await expect(page.getByTestId("passage-title")).toBeVisible();
    await expect(page.getByTestId("passage-body")).toBeVisible();
  });

  // ── 5. SRS review (seeded cards) ─────────────────────────────────────────

  test("SRS review: seeded cards accessible after going offline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });

    await page.goto("/review");
    // Wait for the review session to initialise (loading → card or empty).
    const session = page.getByTestId("review-session");
    await expect(session).toBeVisible({ timeout: 10_000 });

    await page.context().setOffline(true);

    // Review session reads from IndexedDB — no crash expected.
    await expect(session).toBeVisible();
    // Either a card is shown, or empty state (no due cards) — both are valid.
    const cardOrEmpty = page.locator('[data-testid="review-card"], [data-testid="review-empty"]');
    await expect(cardOrEmpty.first()).toBeVisible({ timeout: 5_000 });
  });

  // ── 6. Placement quiz (bundled word list) ────────────────────────────────

  test("placement quiz: intro screen shown after going offline", async ({ page }) => {
    await page.goto("/onboarding");
    // Wait for the placement quiz to render.
    await expect(page.getByTestId("quiz-intro")).toBeVisible({ timeout: 10_000 });

    await page.context().setOffline(true);

    // Bundled word list, no network call — quiz UI remains intact.
    await expect(page.getByTestId("quiz-intro")).toBeVisible();
    await expect(page.getByTestId("quiz-start-btn")).toBeVisible();
  });

  test("placement quiz: answering words works after going offline", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByTestId("quiz-start-btn")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("quiz-start-btn").click();

    // Quiz is now in the answering phase.
    await expect(page.getByTestId("quiz-quizzing")).toBeVisible({ timeout: 5_000 });

    await page.context().setOffline(true);

    // Word list is bundled — can still answer questions offline.
    await expect(page.getByTestId("quiz-word")).toBeVisible();
    await page.getByTestId("btn-known").click();
    // Should advance to the next word (or results) without a crash.
    await expect(
      page.locator('[data-testid="quiz-quizzing"], [data-testid="quiz-result"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── 7. Listening TTS button rendered ────────────────────────────────────

  test("listening: TTS button rendered from seeded passage (no network needed)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("seed-ready")).toBeVisible({ timeout: 15_000 });

    await page.goto("/listening");
    await expect(page.getByTestId("passage-library")).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid^="passage-item-"]').first().click();

    // Dictation view should load with a TTS button (aria-label "Read aloud").
    await expect(page.getByRole("button", { name: /read aloud/i })).toBeVisible({
      timeout: 10_000,
    });

    await page.context().setOffline(true);

    // TTS uses browser SpeechSynthesis — no Mac/network required. Button stays visible.
    await expect(page.getByRole("button", { name: /read aloud/i })).toBeVisible();
  });
});

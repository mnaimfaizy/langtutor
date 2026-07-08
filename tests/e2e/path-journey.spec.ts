import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

// Issue #62 — visual journey (adventure map / premium path, node fill, continue,
// chapter-complete). Covers the issue's own e2e checklist: node state reflects unit status,
// continue lands in the first pending activity, kid vs adult render differs, cross-palette
// checks. Prior art: tests/e2e/learning-path.spec.ts (issue #57, node testids/data-status this
// spec builds on), tests/e2e/unit-player.spec.ts (embedded activity flow), and
// tests/e2e/experience-mode.spec.ts / cross-palette-*.spec.ts (mode/palette switching).
const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword — see onboarding.spec.ts

test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
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
}

/** Rates every due card as "good" until the review session reaches its summary. */
async function rateAllDueCardsGood(page: Page): Promise<void> {
  const summary = page.getByTestId("review-summary");
  const reveal = page.getByTestId("btn-reveal");
  const rateGood = page.getByTestId("btn-rate-good");
  const progress = page.getByTestId("review-progress");

  for (let i = 0; i < 40; i++) {
    if (await summary.isVisible()) return;
    await expect(reveal.or(summary)).toBeVisible({ timeout: 10_000 });
    if (await summary.isVisible()) return;

    const text = (await progress.textContent()) ?? "";
    const [posStr, totalStr] = text.split("/").map((s) => s.trim());
    const isLast = Number(posStr) >= Number(totalStr);

    await reveal.click();
    await expect(rateGood).toBeVisible({ timeout: 10_000 });
    await rateGood.click();

    if (isLast) {
      await expect(summary).toBeVisible({ timeout: 10_000 });
      return;
    }
  }
}

test("one-tap continue resumes the current unit's first pending activity, and the node's state tracks it", async ({
  page,
}) => {
  await setupWithSeed(page);

  const continueCard = page.getByTestId("path-continue");
  await expect(continueCard).toBeVisible();

  const firstUnit = page.getByTestId("unit-0");
  await expect(firstUnit).toHaveAttribute("data-status", "available");
  await expect(firstUnit).toHaveAttribute("data-current", "true");
  const unitId = await firstUnit.getAttribute("data-unit-id");

  // One tap from home, no stop at the unit's own activity list first.
  await page.getByTestId("path-continue-btn").click();
  await page.waitForURL(`/review?unit=${unitId}&activity=0`);
  await expect(page.getByTestId("embedded-unit-banner")).toBeVisible();

  await rateAllDueCardsGood(page);
  await expect(page.getByTestId("review-summary")).toBeVisible();
  await page.getByTestId("btn-back-to-unit-or-home").click();
  await page.waitForURL(`/path/${unitId}`);

  // Back on home: the node has visibly transformed from "available" to "in-progress", and
  // the continue card now points at the next pending activity (listening, per the backbone's
  // fixed activity order — see lib/path/backbone-planner.ts).
  await page.goto("/home");
  await expect(firstUnit).toHaveAttribute("data-status", "in-progress");
  await expect(page.getByTestId("path-continue")).toContainText("Listening");
});

test("a locked unit's node is dormant and not a link; only the available unit is", async ({
  page,
}) => {
  await setupWithSeed(page);

  const firstUnit = page.getByTestId("unit-0");
  const secondUnit = page.getByTestId("unit-1");
  await expect(firstUnit).toHaveAttribute("data-status", "available");
  await expect(secondUnit).toHaveAttribute("data-status", "locked");

  // The locked node renders no link wrapper (not clickable into a locked unit)...
  await expect(page.locator('a:has([data-testid="unit-1"])')).toHaveCount(0);
  // ...while the available node does.
  await expect(page.locator('a:has([data-testid="unit-0"])')).toHaveCount(1);
});

test("kid mode renders the adventure register, adult mode the premium register, from the same components", async ({
  page,
}) => {
  await setupWithSeed(page);

  // Adult is the default for a fresh profile.
  await expect(page.getByTestId("learning-path")).toHaveAttribute("data-experience-mode", "adult");
  await expect(page.getByRole("heading", { name: "Your learning path" })).toBeVisible();
  const adultMarkerBox = await page.getByTestId("unit-0-marker").boundingBox();

  await page.goto("/settings");
  await page.getByTestId("experience-mode-btn-kid").click();
  await page.getByTestId("btn-save-experience-mode").click();
  await expect(page.getByRole("status")).toHaveText("Appearance saved.");

  await page.goto("/home");
  await expect(page.locator("html")).toHaveAttribute("data-palette", /^kid-/);
  await expect(page.getByTestId("learning-path")).toHaveAttribute("data-experience-mode", "kid");
  await expect(page.getByRole("heading", { name: "Your adventure map" })).toBeVisible();
  await expect(page.getByTestId("path-continue-btn")).toHaveText("Let's go!");

  // Same component, a visibly bigger "big friendly node" marker in kid mode.
  const kidMarkerBox = await page.getByTestId("unit-0-marker").boundingBox();
  expect(kidMarkerBox?.width ?? 0).toBeGreaterThan(adultMarkerBox?.width ?? 0);
});

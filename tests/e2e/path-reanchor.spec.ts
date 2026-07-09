import { type Page, expect, test } from "./fixtures";

// Issue #63 — the teacher re-plans future units when the learner's CEFR level changes.
// Exercises the full story end to end: a level change via Settings re-anchors not-yet-
// reached (locked) units to the new backbone, while an in-progress unit and its content
// are left byte-for-byte untouched, and the learner's position on the path doesn't reset.
//
// `/api/path/plan` defaults to `{ plans: [] }` via stubMacApis — re-anchoring itself never
// calls the LLM (it just resets a unit back to an unplanned backbone placeholder), so unit
// titles stay deterministic without a reachable Mac.
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

async function changeLevelInSettings(page: Page, level: string) {
  await page.goto("/settings");
  await expect(page.getByTestId("profile-section")).toBeVisible();
  await page.getByTestId("profile-level-select").selectOption(level);
  await page.getByTestId("btn-save-profile").click();
  await expect(page.getByRole("status")).toHaveText("Profile updated.");
}

test("a CEFR level change re-anchors future units, leaving the in-progress unit and its content untouched", async ({
  page,
}) => {
  await setupWithSeed(page);

  const firstUnit = page.getByTestId("unit-0");
  const secondUnit = page.getByTestId("unit-1");
  await expect(firstUnit).toBeVisible();
  await expect(secondUnit).toBeVisible();

  const unitId = await firstUnit.getAttribute("data-unit-id");
  expect(unitId).toBeTruthy();

  // Snapshot the backbone-placeholder content of both units before anything changes.
  const beforeSecondUnitText = await secondUnit.innerText();

  // Start (but don't finish) the first unit — review is activity 0 of 5, so completing it
  // alone leaves the unit "in-progress", not "completed". This is the "history" that must
  // stay byte-for-byte untouched by a later re-anchor.
  await firstUnit.click();
  await page.waitForURL(`/path/${unitId}`);
  await page.getByTestId("btn-start-activity-0").click();
  await page.waitForURL(`/review?unit=${unitId}&activity=0`);
  await rateAllDueCardsGood(page);
  await expect(page.getByTestId("review-summary")).toBeVisible();
  await page.getByTestId("btn-back-to-unit-or-home").click();
  await page.waitForURL(`/path/${unitId}`);

  await page.goto("/home");
  await expect(firstUnit).toHaveAttribute("data-status", "in-progress");
  const beforeFirstUnitText = await firstUnit.innerText();

  // The level jumps from A1 to B1 — a real move, not a no-op — via Settings, the same
  // profile-save path the placement quiz uses.
  await changeLevelInSettings(page, "B1");

  await page.goto("/home");
  await expect(firstUnit).toBeVisible();
  await expect(secondUnit).toBeVisible();

  // The in-progress unit (this learner's "history") is completely unchanged: same status,
  // same id, same title/note/marker — no jarring reset of position.
  await expect(firstUnit).toHaveAttribute("data-unit-id", unitId!);
  await expect(firstUnit).toHaveAttribute("data-status", "in-progress");
  expect(await firstUnit.innerText()).toBe(beforeFirstUnitText);

  // The next (locked, not-yet-reached) unit re-anchors to the new B1 backbone — different
  // content than before, but still rendered at the same path position (`unit-1`), still
  // locked (nothing was force-unlocked by the level change).
  await expect(secondUnit).toHaveAttribute("data-status", "locked");
  const afterSecondUnitText = await secondUnit.innerText();
  expect(afterSecondUnitText).not.toBe(beforeSecondUnitText);

  // Reflected without any manual action beyond the settings save — no re-seed/replay needed.
  await page.reload();
  await expect(secondUnit).toBeVisible();
  expect(await secondUnit.innerText()).toBe(afterSecondUnitText);
});

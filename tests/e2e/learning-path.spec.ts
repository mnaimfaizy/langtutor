import { expect, test } from "@playwright/test";

const BATCH_SIZE = 6; // WORDS_PER_BATCH (5) + 1 pseudoword — see onboarding.spec.ts

// Issue #57 — path skeleton. A fresh account (no profile, no units) completes
// onboarding and lands on /home with a deterministic, backbone-seeded path:
// first unit available, everything after it locked. No LLM/network involved.
test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
});

test("fresh account's home shows a seeded path with the first unit available and later units locked", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await expect(page.getByTestId("quiz-intro")).toBeVisible();
  await page.getByTestId("quiz-start-btn").click();
  await expect(page.getByTestId("quiz-quizzing")).toBeVisible();

  // Answer every word "Don't know" — stops at A1, so the path anchors at A1.
  for (let i = 0; i < BATCH_SIZE; i++) {
    await page.getByTestId("btn-unknown").click();
  }
  await expect(page.getByTestId("quiz-result-level")).toHaveText("A1");
  await page.getByTestId("btn-save-level").click();

  await expect(page.getByTestId("goals-picker")).toBeVisible();
  await page.getByTestId("goal-btn-general").click();
  await page.getByTestId("btn-save-goals").click();
  await page.waitForURL("/home");

  const path = page.getByTestId("learning-path");
  await expect(path).toBeVisible();

  const firstUnit = page.getByTestId("unit-0");
  const secondUnit = page.getByTestId("unit-1");
  await expect(firstUnit).toBeVisible();
  await expect(secondUnit).toBeVisible();

  await expect(firstUnit).toHaveAttribute("data-status", "available");
  await expect(secondUnit).toHaveAttribute("data-status", "locked");
  await expect(firstUnit.getByText("Start")).toBeVisible();
  await expect(secondUnit.getByText("Locked")).toBeVisible();

  // The module hub's direct links remain reachable alongside the path.
  await expect(page.getByTestId("btn-reading")).toBeVisible();
});

test("revisiting home does not re-seed or reorder the path", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByTestId("quiz-start-btn").click();
  for (let i = 0; i < BATCH_SIZE; i++) {
    await page.getByTestId("btn-unknown").click();
  }
  await page.getByTestId("btn-save-level").click();
  await page.getByTestId("goal-btn-general").click();
  await page.getByTestId("btn-save-goals").click();
  await page.waitForURL("/home");

  await expect(page.getByTestId("unit-0")).toBeVisible();
  const firstVisitTitle = await page.getByTestId("unit-0").innerText();

  await page.goto("/home");

  await expect(page.getByTestId("unit-0")).toBeVisible();
  await expect(page.getByTestId("unit-0")).toHaveAttribute("data-status", "available");
  expect(await page.getByTestId("unit-0").innerText()).toBe(firstVisitTitle);
});

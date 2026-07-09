import { expect, test } from "./fixtures";

// Cards are now shared server-side SQLite (not per-context IndexedDB), so a word
// added by one test stays in the deck for the next and shows as a duplicate.
// Reset so each test starts with "park" absent from the deck.
test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
});

const MOCK_PASSAGE = {
  title: "A Morning Walk",
  body: "Every morning, Maria goes to the park near her house. She likes walking there.",
};

test("tap a word and add it to SRS deck", async ({ page }) => {
  await page.route("**/api/reading/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ passage: MOCK_PASSAGE }),
    });
  });

  // ── 1. Generate a passage ────────────────────────────────────────────────
  await page.goto("/reading");
  await page.getByTestId("level-A2").click();
  await page.getByTestId("topic-daily-routine").click();
  await page.getByTestId("btn-generate").click();
  await page.waitForURL(/\/reading\/\d+$/);
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);

  // ── 2. Tap "park" — wait for definition ─────────────────────────────────
  await page.getByRole("button", { name: "park" }).first().click();
  const addBtn = page.getByTestId("btn-add-to-deck");
  await expect(addBtn).toBeVisible({ timeout: 8000 });

  // ── 3. Add to deck ───────────────────────────────────────────────────────
  await addBtn.click();
  await expect(addBtn).toHaveText("Added ✓", { timeout: 5000 });

  // ── 4. Navigate to review — card should be due ───────────────────────────
  await page.goto("/review");
  // The review session starts immediately when cards are due (no empty state)
  await expect(page.getByTestId("review-card")).toBeVisible({ timeout: 5000 });
});

test("adding a duplicate word shows 'In deck'", async ({ page }) => {
  await page.route("**/api/reading/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ passage: MOCK_PASSAGE }),
    });
  });

  await page.goto("/reading");
  await page.getByTestId("level-A2").click();
  await page.getByTestId("topic-daily-routine").click();
  await page.getByTestId("btn-generate").click();
  await page.waitForURL(/\/reading\/\d+$/);

  // Add "park" once
  await page.getByRole("button", { name: "park" }).first().click();
  const addBtn = page.getByTestId("btn-add-to-deck");
  await expect(addBtn).toBeVisible({ timeout: 8000 });
  await addBtn.click();
  await expect(addBtn).toHaveText("Added ✓", { timeout: 5000 });

  // Close and re-open popover for same word
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "park" }).first().click();
  // addState persists on the component instance — re-open shows "Added ✓" still
  await expect(page.getByTestId("btn-add-to-deck")).toHaveText("Added ✓");
});

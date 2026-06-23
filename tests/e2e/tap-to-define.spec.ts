import { expect, test } from "@playwright/test";

const MOCK_PASSAGE = {
  title: "A Morning Walk",
  body: "Every morning, Maria goes to the park near her house. She likes walking there.",
};

/**
 * Tap-to-define e2e tests.
 *
 * The /api/lexicon/define route calls the real WordNet bundle + Free Dictionary
 * API (server-side) rather than the browser, so page.route() cannot intercept it.
 * Tests verify structural behavior: popover opens with data; data persists offline.
 */
test("tap a word to see definition, definition cached and shown offline", async ({ page }) => {
  // Mock passage generation so no Mac is required.
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

  // ── 2. Tap "morning" — popover opens with definition ────────────────────
  await page.getByRole("button", { name: "morning" }).first().click();

  // The popover must show a phonetic IPA string (proves the lookup succeeded).
  const phonetic = page.getByTestId("word-phonetic");
  await expect(phonetic).toBeVisible({ timeout: 8000 });
  const phoneticText = (await phonetic.textContent()) ?? "";
  expect(phoneticText.length).toBeGreaterThan(0);

  // ── 3. Go offline: block all API routes ─────────────────────────────────
  await page.route("**/api/**", (route) => route.abort());

  // ── 4. Reload — passage must load from IndexedDB ─────────────────────────
  await page.reload();
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);

  // ── 5. Tap "morning" again — definition from IndexedDB cache ─────────────
  await page.getByRole("button", { name: "morning" }).first().click();
  await expect(page.getByTestId("word-phonetic")).toBeVisible({ timeout: 5000 });
  // Same phonetic string confirms the cached entry was used, not re-fetched.
  await expect(page.getByTestId("word-phonetic")).toHaveText(phoneticText);
});

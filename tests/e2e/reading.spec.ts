import { expect, test } from "./fixtures";

const MOCK_PASSAGE = {
  title: "A Walk in the Park",
  body: "Every morning, Maria goes to the park near her house. She likes to walk there because it is quiet and calm. The park has many trees and flowers. In spring, the flowers are red and yellow. Maria often sits on a bench and reads her book. Sometimes she meets her friend Ana there. They talk and drink coffee. After one hour, Maria goes home. She feels happy after her walk.",
};

test("generate a passage, reload offline, passage still in library", async ({ page }) => {
  // Intercept the generation API so no Mac is required.
  await page.route("**/api/reading/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ passage: MOCK_PASSAGE }),
    });
  });

  // ── 1. Navigate to /reading ──────────────────────────────────────────────
  await page.goto("/reading");
  await expect(page.getByRole("heading", { name: "Reading", level: 1 })).toBeVisible();

  // ── 2. Select A2, pick "daily routine" topic, generate ──────────────────
  await page.getByTestId("level-A2").click();
  await page.getByTestId("topic-daily-routine").click();
  await page.getByTestId("btn-generate").click();

  // ── 3. Wait for navigation to the passage page ───────────────────────────
  await page.waitForURL(/\/reading\/\d+$/);
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);
  await expect(page.getByTestId("passage-body")).toContainText("Maria");

  // ── 4. Navigate back to library ──────────────────────────────────────────
  await page
    .getByRole("link", { name: /back to reading/i })
    .first()
    .click();
  await page.waitForURL(/\/reading$/);

  // ── 5. Simulate offline: block all API & network requests ────────────────
  await page.route("**/api/**", (route) => route.abort());

  // ── 6. Reload — cached passage should still appear in the library ────────
  await page.reload();
  await expect(page.getByTestId("passage-library")).toBeVisible();
  await expect(page.getByTestId("passage-library")).toContainText(MOCK_PASSAGE.title);

  // ── 7. Open the cached passage (reads from IndexedDB) ────────────────────
  await page.getByText(MOCK_PASSAGE.title).click();
  await page.waitForURL(/\/reading\/\d+$/);
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);
  await expect(page.getByTestId("passage-body")).toContainText("Maria");
});

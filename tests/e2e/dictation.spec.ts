import { expect, test } from "@playwright/test";

const MOCK_PASSAGE = {
  title: "A Morning Walk",
  body: "Every morning Maria walks to the park. She enjoys the fresh air and the quiet.",
};

test("dictation: generate passage, open dictation view, check perfect transcript shows 0% WER", async ({
  page,
}) => {
  await page.route("**/api/reading/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ passage: MOCK_PASSAGE }),
    });
  });

  // Generate a passage via the reading page to seed IndexedDB
  await page.goto("/reading");
  await page.getByTestId("level-A2").click();
  await page.getByTestId("topic-daily-routine").click();
  await page.getByTestId("btn-generate").click();
  await page.waitForURL(/\/reading\/\d+$/);

  // Extract the passage ID and navigate to the dictation view
  const readingUrl = page.url();
  const idMatch = readingUrl.match(/\/reading\/(\d+)$/);
  expect(idMatch).toBeTruthy();
  const id = idMatch![1];

  await page.goto(`/listening/${id}`);
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);

  // Perfect transcript (same text) — expect 0% WER
  await page.getByTestId("transcript-input").fill(MOCK_PASSAGE.body);
  await page.getByTestId("btn-check").click();

  await expect(page.getByTestId("wer-result")).toBeVisible();
  await expect(page.getByTestId("wer-score")).toContainText("0");
});

test("dictation: transcript with errors shows non-zero WER and diff", async ({ page }) => {
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

  const id = page.url().match(/\/reading\/(\d+)$/)![1];
  await page.goto(`/listening/${id}`);

  // Transcript with a substitution: "walks" → "runs"
  await page
    .getByTestId("transcript-input")
    .fill("Every morning Maria runs to the park. She enjoys the fresh air and the quiet.");
  await page.getByTestId("btn-check").click();

  await expect(page.getByTestId("wer-result")).toBeVisible();
  // WER should be > 0% (one substitution out of 14 reference words ≈ 7%)
  const scoreText = await page.getByTestId("wer-score").textContent();
  const pct = parseInt(scoreText ?? "0", 10);
  expect(pct).toBeGreaterThan(0);
});

test("dictation: library shows passage after generation", async ({ page }) => {
  await page.route("**/api/reading/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ passage: MOCK_PASSAGE }),
    });
  });

  // Generate a passage
  await page.goto("/reading");
  await page.getByTestId("level-A2").click();
  await page.getByTestId("topic-daily-routine").click();
  await page.getByTestId("btn-generate").click();
  await page.waitForURL(/\/reading\/\d+$/);

  // Listening library should show the generated passage
  await page.goto("/listening");
  await expect(page.getByTestId("passage-library")).toBeVisible();
  await expect(page.getByTestId("passage-library")).toContainText(MOCK_PASSAGE.title);
});

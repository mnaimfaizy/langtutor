import { type Page, expect, test } from "./fixtures";

const MOCK_PASSAGE = {
  title: "A Morning Walk",
  body: "Every morning Maria walks to the park. She enjoys the fresh air and the quiet.",
};

const MOCK_QUESTIONS = {
  questions: [
    {
      question: "Where does Maria walk every morning?",
      options: ["To the park", "To the beach", "To the market", "To school"],
      answerIndex: 0,
      category: "detail",
    },
  ],
};

async function seedPassage(page: Page) {
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
  const idMatch = page.url().match(/\/reading\/(\d+)$/);
  return idMatch![1];
}

test("listening comprehension: quiz flow completes and shows score", async ({ page }) => {
  const id = await seedPassage(page);

  await page.route("**/api/reading/questions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_QUESTIONS),
    });
  });

  await page.goto(`/listening/${id}`);
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);

  // Take the comprehension quiz
  await page.getByTestId("listening-quiz-idle").getByRole("button").click();
  await expect(page.getByTestId("listening-quiz-answering")).toBeVisible();
  await expect(page.getByTestId("lq-question-0")).toBeVisible();

  // Select the correct answer (index 0)
  await page.getByTestId("lq-option-0-0").click();
  await page.getByTestId("btn-submit-listening-quiz").click();

  await expect(page.getByTestId("listening-quiz-result")).toBeVisible();
  await expect(page.getByTestId("listening-quiz-score")).toContainText("1/1");
});

test("listening comprehension: wrong answer logs mistake and shows 0 score", async ({ page }) => {
  const id = await seedPassage(page);

  await page.route("**/api/reading/questions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_QUESTIONS),
    });
  });

  await page.goto(`/listening/${id}`);
  await page.getByTestId("listening-quiz-idle").getByRole("button").click();
  await expect(page.getByTestId("listening-quiz-answering")).toBeVisible();

  // Select wrong answer (index 1, correct is 0)
  await page.getByTestId("lq-option-0-1").click();
  await page.getByTestId("btn-submit-listening-quiz").click();

  await expect(page.getByTestId("listening-quiz-result")).toBeVisible();
  await expect(page.getByTestId("listening-quiz-score")).toContainText("0/1");
  await expect(page.getByTestId("listening-quiz-mistakes")).toBeVisible();
});

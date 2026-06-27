import { expect, test } from "@playwright/test";

// Learner data now lives in shared server-side SQLite (not per-context IndexedDB),
// so state leaks between tests. Reset before each to restore isolation.
test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
});

const MOCK_PASSAGE = {
  title: "A Morning Walk",
  body: "Every morning, Maria goes to the park near her house. She likes walking there.",
};

const MOCK_QUESTIONS = {
  questions: [
    {
      question: "Where does Maria go every morning?",
      options: ["To school", "To the park", "To work", "To the store"],
      answerIndex: 1,
      category: "detail",
    },
    {
      question: "What does Maria like to do?",
      options: ["Swimming", "Cooking", "Walking", "Reading"],
      answerIndex: 2,
      category: "detail",
    },
    {
      question: "Where is the park?",
      options: ["Far from her house", "Near her house", "In another city", "At school"],
      answerIndex: 1,
      category: "detail",
    },
  ],
};

test("wrong answers create errorEvents; correct answers do not", async ({ page }) => {
  await page.route("**/api/reading/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ passage: MOCK_PASSAGE }),
    });
  });
  await page.route("**/api/reading/questions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_QUESTIONS),
    });
  });

  // Navigate to a passage
  await page.goto("/reading");
  await page.getByTestId("level-A2").click();
  await page.getByTestId("topic-daily-routine").click();
  await page.getByTestId("btn-generate").click();
  await page.waitForURL(/\/reading\/\d+$/);
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);

  // Start quiz
  await page.getByTestId("quiz-idle").getByRole("button").click();
  await expect(page.getByTestId("quiz-answering")).toBeVisible({ timeout: 5000 });

  // Q0: answer WRONG (option 0 = "To school"; correct = 1)
  await page.getByTestId("option-0-0").click();
  // Q1: answer CORRECT (option 2 = "Walking")
  await page.getByTestId("option-1-2").click();
  // Q2: answer CORRECT (option 1 = "Near her house")
  await page.getByTestId("option-2-1").click();

  await page.getByTestId("btn-submit-quiz").click();
  await expect(page.getByTestId("quiz-result")).toBeVisible({ timeout: 3000 });
  await expect(page.getByTestId("quiz-score")).toHaveText("2/3 correct");
  await expect(page.getByTestId("quiz-mistakes")).toHaveText("1 mistake logged for review.");

  // Verify exactly 1 errorEvent persisted to SQLite. The mistake is written via
  // an async server action, so poll until the count settles.
  await expect
    .poll(
      async () => {
        const res = await page.request.get("/api/test/error-events/count");
        const body = (await res.json()) as { count: number };
        return body.count;
      },
      { timeout: 5000 },
    )
    .toBe(1);
});

test("all correct answers: score 3/3, no mistakes logged", async ({ page }) => {
  await page.route("**/api/reading/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ passage: MOCK_PASSAGE }),
    });
  });
  await page.route("**/api/reading/questions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_QUESTIONS),
    });
  });

  await page.goto("/reading");
  await page.getByTestId("level-A2").click();
  await page.getByTestId("topic-daily-routine").click();
  await page.getByTestId("btn-generate").click();
  await page.waitForURL(/\/reading\/\d+$/);

  await page.getByTestId("quiz-idle").getByRole("button").click();
  await expect(page.getByTestId("quiz-answering")).toBeVisible({ timeout: 5000 });

  // All correct answers
  await page.getByTestId("option-0-1").click(); // Q0 correct = 1
  await page.getByTestId("option-1-2").click(); // Q1 correct = 2
  await page.getByTestId("option-2-1").click(); // Q2 correct = 1

  await page.getByTestId("btn-submit-quiz").click();
  await expect(page.getByTestId("quiz-result")).toBeVisible({ timeout: 3000 });
  await expect(page.getByTestId("quiz-score")).toHaveText("3/3 correct");
  await expect(page.getByTestId("quiz-mistakes")).not.toBeVisible();
});

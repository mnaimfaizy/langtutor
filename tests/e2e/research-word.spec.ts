import { expect, test } from "@playwright/test";

const MOCK_PASSAGE = {
  title: "A Morning Walk",
  body: "Every morning Maria goes to the park near her house She likes walking there",
};

const MOCK_DEFINITION = {
  found: true,
  word: "morning",
  definition: "The early part of the day, before noon.",
  examples: ["She goes for a walk every morning.", "I had coffee this morning."],
  pos: "n",
  cefr: "A1",
  phonetic: null,
  audioUrl: null,
};

async function goToPassage(page: import("@playwright/test").Page) {
  await page.route("**/api/reading/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ passage: MOCK_PASSAGE }),
    });
  });
  // All define calls return not-found
  await page.route("**/api/lexicon/define**", async (route) => {
    const url = new URL(route.request().url());
    const word = url.searchParams.get("word") ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ found: false, word }),
    });
  });

  await page.goto("/reading");
  await page.getByTestId("level-A2").click();
  await page.getByTestId("topic-daily-routine").click();
  await page.getByTestId("btn-generate").click();
  await page.waitForURL(/\/reading\/\d+$/);
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);
}

test("not-found word: Research button → agent → definition shown → cached", async ({ page }) => {
  let agentCalls = 0;
  await page.route("**/api/agent/research-word", async (route) => {
    agentCalls++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_DEFINITION),
    });
  });

  await goToPassage(page);
  const passageUrl = page.url();

  // Open "morning" word popover — should show not-found + Research button
  await page.getByTestId("word-btn").filter({ hasText: "morning" }).first().click();
  await expect(page.getByTestId("btn-research")).toBeVisible({ timeout: 3000 });

  // Click Research — definition should appear
  await page.getByTestId("btn-research").click();
  await expect(page.getByText("The early part of the day, before noon.")).toBeVisible({
    timeout: 5000,
  });
  expect(agentCalls).toBe(1);

  // Navigate away, mock agent as offline, come back — should hit cache
  await page.goto("/reading");
  await page.unroute("**/api/agent/research-word");
  await page.route("**/api/agent/research-word", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: '{"error":"offline"}',
    });
  });

  await page.goto(passageUrl);
  await expect(page.getByTestId("passage-title")).toHaveText(MOCK_PASSAGE.title);

  // Open same word — cache hit; definition shown immediately, Research button absent
  await page.getByTestId("word-btn").filter({ hasText: "morning" }).first().click();
  await expect(page.getByText("The early part of the day, before noon.")).toBeVisible({
    timeout: 3000,
  });
  await expect(page.getByTestId("btn-research")).not.toBeVisible();

  // Agent was only called once total
  expect(agentCalls).toBe(1);
});

test("Mac offline → graceful unavailable message", async ({ page }) => {
  await page.route("**/api/agent/research-word", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: '{"error":"offline"}',
    });
  });

  await goToPassage(page);

  await page.getByTestId("word-btn").filter({ hasText: "morning" }).first().click();
  await expect(page.getByTestId("btn-research")).toBeVisible({ timeout: 3000 });

  await page.getByTestId("btn-research").click();
  await expect(page.getByTestId("offline-msg")).toHaveText("Unavailable — connect to Mac.", {
    timeout: 5000,
  });
});

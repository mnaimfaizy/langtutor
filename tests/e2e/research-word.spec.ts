/**
 * Phase 3.5 — runtime enrichment agent e2e.
 *
 * The /api/lexicon/define route runs server-side (WordNet bundle + Free Dictionary API)
 * so page.route() cannot reliably intercept it when a service worker is active.
 * Strategy: include a nonsense word ("zorblax") in the passage that is guaranteed
 * not to be in WordNet. The real API returns { found: false }, which triggers the
 * Research button — no mocking of the lexicon route is needed.
 */

import { expect, test } from "@playwright/test";

// The lexicon cache is now global server-side SQLite (not per-context IndexedDB):
// a word researched by one test stays cached for the next, hiding the Research
// button. Reset clears lexicon_cache so each test starts with zorblax unknown.
test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset");
});

// "zorblax" is a nonsense word absent from all dictionaries — guaranteed not-found.
const RESEARCH_WORD = "zorblax";

const MOCK_PASSAGE = {
  title: "A Morning Walk",
  body: `Every morning Maria goes to the ${RESEARCH_WORD} near her house She likes walking there`,
};

const MOCK_DEFINITION = {
  found: true,
  word: RESEARCH_WORD,
  definition: "A fictional outdoor space.",
  examples: [`She walks to the ${RESEARCH_WORD} every morning.`],
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

  // Open nonsense word popover — real API returns not-found, so Research button appears.
  await page.getByTestId("word-btn").filter({ hasText: RESEARCH_WORD }).first().click();
  await expect(page.getByTestId("btn-research")).toBeVisible({ timeout: 10_000 });

  // Click Research — mocked agent returns a definition.
  await page.getByTestId("btn-research").click();
  await expect(page.getByText(MOCK_DEFINITION.definition)).toBeVisible({ timeout: 10_000 });
  expect(agentCalls).toBe(1);

  // Navigate away, swap agent mock to 502, come back — cache hit should serve definition.
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

  // Re-open the same word — cached definition shown immediately, no Research button.
  await page.getByTestId("word-btn").filter({ hasText: RESEARCH_WORD }).first().click();
  await expect(page.getByText(MOCK_DEFINITION.definition)).toBeVisible({ timeout: 3000 });
  await expect(page.getByTestId("btn-research")).not.toBeVisible();

  // Agent called exactly once (first lookup only).
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

  // Nonsense word → real API returns not-found → Research button appears.
  await page.getByTestId("word-btn").filter({ hasText: RESEARCH_WORD }).first().click();
  await expect(page.getByTestId("btn-research")).toBeVisible({ timeout: 10_000 });

  // Click Research — agent returns 502 (Mac offline).
  await page.getByTestId("btn-research").click();
  await expect(page.getByTestId("offline-msg")).toHaveText("Unavailable — connect to Mac.", {
    timeout: 5000,
  });
});

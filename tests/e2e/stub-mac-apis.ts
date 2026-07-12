/**
 * Default Playwright network stubs for every Mac-facing same-origin route.
 *
 * Home loads fire `/api/path/plan` + (after a plan) generate/embeddings; every
 * authenticated page also hits `/api/llm/health` and `/api/llm/warmup`. Without
 * these stubs, e2e talks to the real Mac whenever it is online — non-deterministic
 * titles/vocab, GPU load, and connection-pool hangs when embeddings never return.
 *
 * Register via `tests/e2e/fixtures.ts` (automatic) or call `stubMacApis(page)`
 * directly. To replace `/api/path/plan`, use `overridePathPlan` (it unroutes the
 * default empty-plans stub first). Other routes can be overridden with a later
 * `page.route` (Playwright LIFO).
 *
 * Requires `serviceWorkers: "block"` on the browser context (set in
 * playwright.config.ts). Serwist's NetworkOnly rules for Mac-dependent APIs
 * otherwise intercept fetch before Playwright routing and talk to the real Mac.
 */
import type { Page, Route } from "@playwright/test";

export const MOCK_PASSAGE = {
  title: "Everyday Habits",
  body: "Every day, Sam wakes up early and drinks a cup of tea. He walks to work because the office is close to his house. At lunch, he eats a sandwich with his friends. In the evening, he reads a book before he goes to sleep. Sam likes his simple daily routine because it helps him feel calm and ready for each new day.",
};

export const MOCK_PROMPT = {
  title: "Your Daily Routine",
  instruction: "Write a few sentences describing your typical morning routine.",
};

export const MOCK_FEEDBACK = {
  overallScore: 8,
  structuralGrade: "Good",
  corrections: [] as unknown[],
};

export const MOCK_EMBEDDING = [0.1, 0.2, 0.3];

/** Fixed-shape pre-A1 exam fill (issue #115 / #120). Correct answer is always option 0. */
export const MOCK_PRE_A1_EXAM_FILL = {
  items: (["alphabet", "phonics", "picture-words", "listen-tap"] as const).flatMap((skill) =>
    [1, 2, 3].map((n) => ({
      skill,
      prompt: `E2E ${skill} question ${n}?`,
      options: ["A", "B", "C", "D"] as [string, string, string, string],
      answerIndex: 0 as const,
    })),
  ),
};

export const MOCK_PRE_A1_TEACHER_REPORT = {
  headline: "E2E teacher report",
  body: "You practiced alphabet, phonics, picture words, and listen and tap. Keep going.",
  encouragement: "Nice work — practice a little more and try again soon.",
  focusSkills: ["phonics"] as const,
};

export interface StubMacApisOptions {
  /** Override the default empty teacher-plan response. */
  plans?: unknown[];
}

async function json(
  route: { fulfill: (opts: Record<string, unknown>) => Promise<void> },
  body: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Replaces the default `/api/path/plan` stub. Always `unroute`s first so the
 * fixture's empty-plans handler cannot win a LIFO race against a later override.
 */
export async function overridePathPlan(
  page: Page,
  handler: (route: Route) => Promise<void>,
): Promise<void> {
  await page.unroute("**/api/path/plan");
  await page.route("**/api/path/plan", handler);
}

/** Installs Mac-isolation stubs on @page. Safe to call more than once. */
export async function stubMacApis(page: Page, options: StubMacApisOptions = {}): Promise<void> {
  const plans = options.plans ?? [];

  await overridePathPlan(page, async (route) => {
    await json(route, { plans });
  });

  await page.route("**/api/llm/embeddings", async (route) => {
    await json(route, { embeddings: [MOCK_EMBEDDING] });
  });

  await page.route("**/api/llm/warmup", async (route) => {
    await json(route, { ok: true });
  });

  await page.route("**/api/llm/health", async (route) => {
    await json(route, { ok: true, models: ["e2e-mock"] });
  });

  await page.route("**/api/llm/chat", async (route) => {
    await json(route, { text: "e2e-mock" });
  });

  await page.route("**/api/reading/generate", async (route) => {
    await json(route, { passage: MOCK_PASSAGE });
  });

  await page.route("**/api/writing/generate", async (route) => {
    await json(route, { prompt: MOCK_PROMPT });
  });

  await page.route("**/api/writing/feedback", async (route) => {
    await json(route, { feedback: MOCK_FEEDBACK });
  });

  await page.route("**/api/stt/transcribe", async (route) => {
    await json(route, { transcript: MOCK_PASSAGE.body });
  });

  await page.route("**/api/reading/questions", async (route) => {
    await json(route, {
      questions: [
        {
          prompt: "What does Sam drink?",
          options: ["tea", "coffee", "juice", "water"],
          answerIndex: 0,
        },
      ],
    });
  });

  // Pre-A1 chapter exam fill (issue #115) — fixed shape, three items per skill.
  await page.route("**/api/path/exam/fill", async (route) => {
    await json(route, { exam: MOCK_PRE_A1_EXAM_FILL });
  });

  // Pre-A1 chapter exam teacher report (issue #116).
  await page.route("**/api/path/exam/report", async (route) => {
    await json(route, { report: MOCK_PRE_A1_TEACHER_REPORT });
  });

  await page.route("**/api/agent/research-word", async (route) => {
    await json(route, {
      found: true,
      word: "e2e",
      definition: "Mock definition for e2e isolation.",
      examples: ["This is an e2e mock."],
      pos: "n",
      cefr: "A1",
      phonetic: null,
      audioUrl: null,
    });
  });
}

/** Force `/api/path/exam/fill` to fail (pause / offline-buffer paths). Unroutes first. */
export async function stubExamFillFailure(page: Page, status = 503): Promise<void> {
  await page.unroute("**/api/path/exam/fill");
  await page.route("**/api/path/exam/fill", async (route) => {
    await json(route, { error: "e2e fill unavailable" }, status);
  });
}

/** Force `/api/path/exam/report` to fail (deferred-report path). Unroutes first. */
export async function stubExamReportFailure(page: Page, status = 503): Promise<void> {
  await page.unroute("**/api/path/exam/report");
  await page.route("**/api/path/exam/report", async (route) => {
    await json(route, { error: "e2e report unavailable" }, status);
  });
}

/** Restore the default successful exam-fill stub (after a failure override). */
export async function stubExamFillSuccess(page: Page): Promise<void> {
  await page.unroute("**/api/path/exam/fill");
  await page.route("**/api/path/exam/fill", async (route) => {
    await json(route, { exam: MOCK_PRE_A1_EXAM_FILL });
  });
}

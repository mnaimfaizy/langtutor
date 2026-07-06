import { expect, test as setup } from "@playwright/test";

export { ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_FILE } from "./auth-constants";
import { ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_FILE } from "./auth-constants";

// Routes visited to pre-warm Turbopack compilation before tests start.
// Without this, the first request to each route triggers on-demand compilation,
// blocking the event loop and causing 10-15 s delays that push tests past the
// 30 s timeout. /onboarding/goals is critical — PlacementQuiz navigates there
// after saving the level, so missing it causes a 15 s freeze mid-test.
const WARMUP_ROUTES = [
  "/onboarding",
  "/onboarding/goals",
  "/reading",
  "/review",
  "/settings",
  "/admin/users",
  "/listening",
  "/writing",
  "/speaking",
  "/diagnostics",
  "/deck",
];

setup("authenticate as admin", async ({ page }) => {
  const bootstrapped = await page.request.post("/api/auth/bootstrap", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });

  if (bootstrapped.ok()) {
    // Fresh DB: bootstrap created the admin and returned a session cookie.
    // We're already signed in — the root should redirect straight to /home.
    await page.goto("/");
    await page.waitForURL("/home");
  } else {
    // DB already has users (409): sign in manually.
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/home");
  }

  await page.context().storageState({ path: AUTH_FILE });

  // Reset: clear all per-user SQLite data so each run starts from a known
  // empty state. This is necessary when the dev server is reused across runs
  // (the DB file is locked and cannot be deleted by global-setup.ts).
  await page.request.post("/api/test/reset");

  // Warm API routes: compile + initialise expensive singletons (WordNet 40 MB)
  // before parallel tests start. These are not page navigations, so they don't
  // appear in WARMUP_ROUTES — they need an explicit request.
  await page.request.get("/api/lexicon/define?word=park");
  await page.request.get("/api/llm/health");

  // Pre-warm Turbopack: visit each route so page components and server-action
  // modules are compiled before tests start.
  //
  // The first route (/onboarding) is special: we wait for seed-ready before
  // navigating away. This does two things:
  //   1. Serialises SeedBootstrap — prevents the 80-card race condition where
  //      10 concurrent navigations each see 0 cards and independently seed.
  //   2. Forces content-actions.ts server actions (getAllCards, addCard, etc.)
  //      to be compiled via the SeedBootstrap effect, so tests don't pay the
  //      Turbopack cost on their first server-action call.
  await page.goto(WARMUP_ROUTES[0]);
  await page.waitForSelector('[data-testid="seed-ready"]', { timeout: 60_000 });

  for (const route of WARMUP_ROUTES.slice(1)) {
    await page.goto(route);
  }

  // Note: /reading/[id] (dynamic route) is not warmed up here because navigating
  // to it requires a generated passage ID. The 60 s test timeout absorbs the
  // one-time Turbopack compilation cost on the first test that hits it.
});

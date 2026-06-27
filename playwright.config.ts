import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;
const AUTH_FILE = "tests/e2e/.auth/user.json";

// E2e smoke tests run against the dev server (auto-started below). Unit tests live in
// tests/** as *.test.ts (Vitest); e2e specs are tests/e2e/**/*.spec.ts (this runner).
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  // Single worker avoids SQLite data races between spec files that share the
  // admin user's profile/cards. CI can override with WORKERS env var.
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // 60 s per test: covers the Turbopack on-demand compile cost (~15 s) on the
  // first visit to any route not hit during the warmup (e.g. /reading/[id]).
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    // Emulate prefers-reduced-motion so framer-motion (via MotionConfig
    // reducedMotion="user") skips transform/layout transitions — card/page
    // changes settle without racing the runner's clicks.
    contextOptions: { reducedMotion: "reduce" },
  },
  expect: {
    timeout: 15_000,
  },
  projects: [
    // Creates an admin user and saves the session cookie to AUTH_FILE.
    { name: "setup", testMatch: "**/auth.setup.ts" },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // All tests run authenticated by default; auth-gate.spec.ts overrides per-test.
        storageState: AUTH_FILE,
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // In CI no server is running, so Playwright starts one with the isolated test DB.
    // Locally, reuse the already-running dev server (points at your real DB).
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      LANGTUTOR_DB_PATH: "./langtutor-e2e.db",
    },
  },
});

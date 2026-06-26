import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;
const AUTH_FILE = "tests/e2e/.auth/user.json";

// E2e smoke tests run against the dev server (auto-started below). Unit tests live in
// tests/** as *.test.ts (Vitest); e2e specs are tests/e2e/**/*.spec.ts (this runner).
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
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
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

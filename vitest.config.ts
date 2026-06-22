import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

// Minimal Vitest setup brought forward for Phase 0.4's fake-indexeddb tests.
// The full harness (Playwright, coverage, CI `verify` wiring) lands in Phase 0.8.
export default defineConfig({
  resolve: {
    // Mirror the tsconfig `@/*` path alias, scoped to `@/` so it never rewrites
    // package names like `@base-ui/react`.
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});

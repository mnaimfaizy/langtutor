import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root explicitly. Without this, Turbopack infers the root
    // from surrounding lockfiles and fails to boot in environments where extra
    // lockfiles/stores exist above the checkout (e.g. sandcastle sandboxes and
    // git worktrees). `next dev`/`next build` always run from the repo root via
    // pnpm scripts, so cwd is correct in every environment.
    root: process.cwd(),
  },
};

// @serwist/turbopack compiles the service worker (app/sw.ts) via esbuild in a route
// handler (app/serwist/[path]/route.ts), so the PWA works under Turbopack with no
// `--webpack` fallback needed (PLAN §8 risk — resolved).
export default withSerwist(nextConfig);

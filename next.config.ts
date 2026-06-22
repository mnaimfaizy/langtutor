import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  /* config options here */
};

// @serwist/turbopack compiles the service worker (app/sw.ts) via esbuild in a route
// handler (app/serwist/[path]/route.ts), so the PWA works under Turbopack with no
// `--webpack` fallback needed (PLAN §8 risk — resolved).
export default withSerwist(nextConfig);

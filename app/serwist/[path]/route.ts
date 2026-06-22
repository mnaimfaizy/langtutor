import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createSerwistRoute } from "@serwist/turbopack";

/** Stable per-build revision for precached entries (git HEAD, or a uuid if unavailable). */
function buildRevision(): string {
  try {
    const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim();
    return head || randomUUID();
  } catch {
    return randomUUID();
  }
}

// Serves /serwist/sw.js (the esbuild-compiled service worker) and precaches the offline page.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    additionalPrecacheEntries: [{ url: "/~offline", revision: buildRevision() }],
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
  },
);

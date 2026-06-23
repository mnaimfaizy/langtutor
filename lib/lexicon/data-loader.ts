// Server-only — reads the generated JSON bundles from data/ using Node.js fs.
// Only import from server contexts (lib/lexicon/server.ts, API routes).
import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CefrData } from "./types";
import type { WordnetData } from "./wordnet-query";

function readJson<T>(relativePath: string): T {
  const fullPath = join(process.cwd(), relativePath);
  try {
    return JSON.parse(readFileSync(fullPath, "utf8")) as T;
  } catch (err) {
    const isNotFound = err instanceof Error && "code" in err && err.code === "ENOENT";
    if (isNotFound) {
      throw new Error(
        `Missing generated data file: ${relativePath}\n` +
          `Run the build script first:\n` +
          `  node scripts/build-wordnet.mjs    # for data/wordnet.json\n` +
          `  node scripts/build-words-cefr.mjs # for data/words-cefr.json`,
      );
    }
    throw err;
  }
}

/** Load the generated data/wordnet.json into memory. Synchronous — call once at startup. */
export function loadWordnet(): WordnetData {
  return readJson<WordnetData>("data/wordnet.json");
}

/** Load the generated data/words-cefr.json into memory. Synchronous — call once at startup. */
export function loadCefrData(): CefrData {
  return readJson<CefrData>("data/words-cefr.json");
}

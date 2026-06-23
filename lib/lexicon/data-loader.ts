// Server-only — reads the generated JSON bundles from data/ using Node.js fs.
// Only import from server contexts (lib/lexicon/server.ts, API routes).
import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CefrData } from "./types";
import type { WordnetData } from "./wordnet-query";

function readJson<T>(relativePath: string): T {
  const fullPath = join(process.cwd(), relativePath);
  return JSON.parse(readFileSync(fullPath, "utf8")) as T;
}

/** Load the generated data/wordnet.json into memory. Synchronous — call once at startup. */
export function loadWordnet(): WordnetData {
  return readJson<WordnetData>("data/wordnet.json");
}

/** Load the generated data/words-cefr.json into memory. Synchronous — call once at startup. */
export function loadCefrData(): CefrData {
  return readJson<CefrData>("data/words-cefr.json");
}

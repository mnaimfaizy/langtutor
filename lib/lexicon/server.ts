// Server-only composition root for the LexiconProvider — mirrors lib/llm/server.ts.
// Feature code must NOT import this file; only API routes and RSC may import it.
import "server-only";

import { loadCefrData, loadWordnet } from "./data-loader";
import type { LexiconProvider } from "./lexicon-provider";
import { LocalLexiconProvider } from "./local-lexicon-provider";

let _provider: LexiconProvider | undefined;

/**
 * Returns the singleton {@link LexiconProvider}, loading WordNet + CEFR data
 * on the first call (synchronous fs reads — expected at server startup, not per-request).
 *
 * Audio-URL caching is omitted on the server: IndexedDB (Dexie) is browser-only.
 * Client-side audio caching is wired in Phase 3.2 when lexicon lookups go through
 * an API route and the client-side LexiconProvider receives a ContentRepository.
 */
export function getLexiconProvider(): LexiconProvider {
  if (!_provider) {
    _provider = new LocalLexiconProvider(loadWordnet(), loadCefrData(), null);
  }
  return _provider;
}

/** Drop the singleton (tests / hot-reload). */
export function _resetLexiconProvider(): void {
  _provider = undefined;
}

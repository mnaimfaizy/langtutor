import type { ContentRepository } from "./db/content-repository";
import { LangTutorDB } from "./db/database";
import { DexieContentRepository } from "./db/dexie-content-repository";

/**
 * Client-safe composition root (PLAN §2.3). Wires the browser-side seams — currently the
 * IndexedDB {@link ContentRepository}. The **server-only** LLM wiring lives in
 * `lib/llm/server.ts` (`getLLMClient`); keeping the two apart is what lets client
 * components import the repository without dragging server-only code (`server-only`,
 * the AI SDK) into the client bundle. Concretes are still constructed only in these roots.
 */
let contentRepository: ContentRepository | undefined;

/**
 * The app-wide {@link ContentRepository}. Construction is lazy so merely importing the
 * registry never opens IndexedDB on the server (route handlers / RSC) — the DB is only
 * created on first use, in the browser.
 */
export function getContentRepository(): ContentRepository {
  if (!contentRepository) {
    contentRepository = new DexieContentRepository(new LangTutorDB());
  }
  return contentRepository;
}

/** Drop the cached singleton so the next getter call rewires a fresh instance (tests). */
export function resetRegistry(): void {
  contentRepository = undefined;
}

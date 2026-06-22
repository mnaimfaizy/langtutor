import type { ContentRepository } from "./db/content-repository";
import { LangTutorDB } from "./db/database";
import { DexieContentRepository } from "./db/dexie-content-repository";

/**
 * Composition root (PLAN §2.3). Concrete providers are constructed **here only**;
 * feature code calls these getters and depends on the seam interfaces. Swapping an
 * implementation (e.g. a future cloud `SyncedRepository`) happens in this file alone.
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

/** Drop cached singletons so the next getter call rewires fresh instances (tests). */
export function resetRegistry(): void {
  contentRepository = undefined;
}

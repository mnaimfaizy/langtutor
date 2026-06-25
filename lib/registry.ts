import type { ContentRepository } from "./db/content-repository";
import { HttpContentRepository } from "./db/http-content-repository";

/**
 * Client-safe composition root (PLAN §2.3). Wires the transport seam — currently an
 * {@link HttpContentRepository} that round-trips through Server Actions to the
 * SQLite-backed {@link SqliteContentRepository} on the server. The **server-only** LLM
 * wiring lives in `lib/llm/server.ts` (`getLLMClient`); keeping the two apart lets
 * client components import the repository without dragging server-only code into the
 * client bundle. Concretes are still constructed only in these roots.
 */
let contentRepository: ContentRepository | undefined;

/**
 * The app-wide {@link ContentRepository}. Lazily constructed so importing the registry
 * never triggers SQLite or IndexedDB on the server.
 */
export function getContentRepository(): ContentRepository {
  if (!contentRepository) {
    contentRepository = new HttpContentRepository();
  }
  return contentRepository;
}

/** Drop the cached singleton so the next getter call rewires a fresh instance (tests). */
export function resetRegistry(): void {
  contentRepository = undefined;
}

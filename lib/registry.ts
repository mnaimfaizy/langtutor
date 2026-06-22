import type { ContentRepository } from "./db/content-repository";
import { LangTutorDB } from "./db/database";
import { DexieContentRepository } from "./db/dexie-content-repository";
import type { LLMClient } from "./llm/llm-client";

/**
 * Composition root (PLAN §2.3). Concrete providers are constructed **here only**;
 * feature code calls these getters and depends on the seam interfaces. Swapping an
 * implementation (e.g. a future cloud `SyncedRepository` / cloud LLM) happens in this
 * file alone.
 */

let contentRepository: ContentRepository | undefined;
let llmClient: LLMClient | undefined;

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

/**
 * The app-wide {@link LLMClient}. **Server-only** — call this from route handlers under
 * `app/api/llm/*`, never from the browser (PLAN §2.1). The Ollama concrete and its env
 * config are loaded via dynamic `import()` so this module stays client-bundle-safe even
 * though it is also the home of {@link getContentRepository}.
 */
export async function getLLMClient(): Promise<LLMClient> {
  if (!llmClient) {
    const [{ OllamaLLMClient }, { loadLLMConfig }] = await Promise.all([
      import("./llm/ollama-llm-client"),
      import("./llm/config"),
    ]);
    llmClient = new OllamaLLMClient(loadLLMConfig());
  }
  return llmClient;
}

/** Drop cached singletons so the next getter call rewires fresh instances (tests). */
export function resetRegistry(): void {
  contentRepository = undefined;
  llmClient = undefined;
}

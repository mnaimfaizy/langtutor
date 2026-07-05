import "server-only";

import { loadLLMConfig } from "./config";
import type { LLMClient } from "./llm-client";
import { OllamaLLMClient } from "./ollama-llm-client";
import { getRuntimeOverride } from "./runtime-config";
import { resolveLLMConfig } from "./settings.server";

/**
 * Server-only composition for the LLM seam (PLAN §2.3). Imported **only** by route handlers
 * under `app/api/llm/*` — never by client code (the `server-only` import makes that a build
 * error, which is why this is split out of `lib/registry.ts`).
 *
 * Built fresh per call (cheap — no network) so it always reflects the current runtime
 * override set via `POST /api/llm/config` (PLAN §3.2 / Phase 0.6).
 */
export async function getLLMClient(): Promise<LLMClient> {
  return new OllamaLLMClient(resolveLLMConfig(loadLLMConfig(), getRuntimeOverride()));
}

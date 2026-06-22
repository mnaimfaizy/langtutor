import "server-only";

import type { LLMOverrides } from "./settings";

/**
 * Server-held runtime LLM override (PLAN §3.2). The browser persists Mac settings in
 * IndexedDB and pushes them here via `POST /api/llm/config`, so **server-side** LLM calls
 * (generation, embeddings, health) honor the user's chosen endpoint/models without the
 * browser threading config through every request. Process-scoped: a single local
 * `next start` process; restored on app load by the settings bootstrap.
 */
let override: LLMOverrides | undefined;

export function getRuntimeOverride(): LLMOverrides | undefined {
  return override;
}

export function setRuntimeOverride(next: LLMOverrides | undefined): void {
  override = next;
}

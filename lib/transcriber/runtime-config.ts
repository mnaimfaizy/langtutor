import "server-only";

import type { SttProvider } from "@/lib/db/drizzle/schema.shared";

/**
 * Server-held runtime STT overrides (mirrors `lib/llm/runtime-config.ts`). The browser
 * persists STT settings in IndexedDB and pushes them here via `POST /api/stt/config`.
 */
let overrideUrl: string | undefined;
let overrideProvider: SttProvider | undefined;

export function getRuntimeSttUrl(): string | undefined {
  return overrideUrl;
}

export function setRuntimeSttUrl(url: string | undefined): void {
  overrideUrl = url;
}

export function getRuntimeSttProvider(): SttProvider | undefined {
  return overrideProvider;
}

export function setRuntimeSttProvider(provider: SttProvider | undefined): void {
  overrideProvider = provider;
}

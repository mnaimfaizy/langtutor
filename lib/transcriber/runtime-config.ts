import "server-only";

/**
 * Server-held runtime STT URL override (mirrors `lib/llm/runtime-config.ts`). The browser
 * persists `macSttUrl` in IndexedDB and pushes it here via `POST /api/stt/config`, so
 * server-side transcription calls honor the user's chosen whisper.cpp endpoint after a
 * server restart. Process-scoped: restored on app load by `SettingsBootstrap`.
 */
let overrideUrl: string | undefined;

export function getRuntimeSttUrl(): string | undefined {
  return overrideUrl;
}

export function setRuntimeSttUrl(url: string | undefined): void {
  overrideUrl = url;
}

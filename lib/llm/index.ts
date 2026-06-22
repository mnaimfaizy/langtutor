/**
 * Public surface of the LLM layer for feature/server code: the `LLMClient` **interface**
 * and its option types. Obtain an instance via `getLLMClient()` in `lib/registry.ts`.
 * The Ollama concrete and `MockLLMClient` are imported from their own paths (the concrete
 * is server-only; the mock is a test util) — never re-exported here.
 */
export type { LLMClient } from "./llm-client";
export type { ChatMessage, ChatObjectOptions, ChatOptions, ChatRole } from "./types";

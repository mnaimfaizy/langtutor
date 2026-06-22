import type { ChatMessage, ChatObjectOptions, ChatOptions } from "./types";

/**
 * LLM seam (PLAN §2.3). Feature/server code imports **this interface**; the concrete
 * (`OllamaLLMClient`, via the Vercel AI SDK → Ollama) is wired in `lib/registry.ts`.
 * "Move to a cloud LLM later" = swap the concrete there, not at any call site.
 *
 * The concrete only ever runs server-side (route handlers under `app/api/llm/*`); the
 * browser reaches it through those same-origin routes, never directly (PLAN §2.1).
 */
export interface LLMClient {
  /** Free-text chat completion. */
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  /** Structured chat completion, validated against (and typed by) a Zod schema. */
  chat<T>(messages: ChatMessage[], opts: ChatObjectOptions<T>): Promise<T>;

  /** Streaming chat — resolves to an async iterable of text chunks. */
  streamChat(messages: ChatMessage[], opts?: ChatOptions): Promise<AsyncIterable<string>>;

  /** Embed each input text into a vector (output row-aligned with input). */
  embed(texts: string[]): Promise<number[][]>;

  /** Model ids advertised by the backend — backs the `/api/llm/health` check. */
  listModels(): Promise<string[]>;
}

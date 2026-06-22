import type { LLMClient } from "./llm-client";
import type { ChatMessage, ChatObjectOptions, ChatOptions } from "./types";

/** Canned responses for {@link MockLLMClient} — everything is optional. */
export interface MockLLMClientOptions {
  /** Returned by text chats and streamed (whitespace-split) by `streamChat`. */
  text?: string;
  /** Returned by schema chats — validated against the call's schema, exactly like the real client. */
  object?: unknown;
  /** Vector for each input text; defaults to a single-element `[length]` vector. */
  embedding?: (text: string, index: number) => number[];
  models?: string[];
}

/**
 * Offline {@link LLMClient} for tests (PLAN §1 #12). Touches no network and no Mac, so the
 * risky logic — schema validation, row-aligned embeddings, streaming — is unit-testable
 * without the Mac reachable.
 */
export class MockLLMClient implements LLMClient {
  constructor(private readonly opts: MockLLMClientOptions = {}) {}

  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  chat<T>(messages: ChatMessage[], opts: ChatObjectOptions<T>): Promise<T>;
  async chat<T>(
    _messages: ChatMessage[],
    opts?: ChatOptions | ChatObjectOptions<T>,
  ): Promise<string | T> {
    if (opts && "schema" in opts) {
      // Parse, don't cast — mirrors the real client's validation so tests catch bad fixtures.
      return opts.schema.parse(this.opts.object);
    }
    return this.opts.text ?? "mock response";
  }

  async streamChat(_messages: ChatMessage[], _opts?: ChatOptions): Promise<AsyncIterable<string>> {
    const words = (this.opts.text ?? "mock response").split(" ");
    async function* chunks(): AsyncGenerator<string> {
      for (let i = 0; i < words.length; i++) {
        yield i === 0 ? words[i] : ` ${words[i]}`;
      }
    }
    return chunks();
  }

  async embed(texts: string[]): Promise<number[][]> {
    const embed = this.opts.embedding ?? ((text: string) => [text.length]);
    return texts.map((text, index) => embed(text, index));
  }

  async listModels(): Promise<string[]> {
    return this.opts.models ?? ["mock-chat", "mock-embed"];
  }
}

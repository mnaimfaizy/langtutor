import "server-only";

import { createOpenAICompatible, type OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import { embedMany, generateObject, generateText, streamText, type ModelMessage } from "ai";
import { z } from "zod";

import type { LLMConfig } from "./config";
import type { LLMClient } from "./llm-client";
import type { ChatMessage, ChatObjectOptions, ChatOptions } from "./types";

/** Shape of an OpenAI-compatible `GET /models` response (the only field we need). */
const ModelsResponse = z.object({
  data: z.array(z.object({ id: z.string() })),
});

/**
 * {@link LLMClient} backed by the Vercel AI SDK against an OpenAI-compatible Ollama
 * endpoint (PLAN §1 #4). Server-only: this module talks to the Mac, so it must never be
 * bundled for the browser — `import "server-only"` makes a client import a build error.
 */
export class OllamaLLMClient implements LLMClient {
  private readonly provider: OpenAICompatibleProvider;

  constructor(private readonly config: LLMConfig) {
    this.provider = createOpenAICompatible({
      name: "ollama",
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
  }

  private toModelMessages(messages: ChatMessage[]): ModelMessage[] {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  chat<T>(messages: ChatMessage[], opts: ChatObjectOptions<T>): Promise<T>;
  async chat<T>(
    messages: ChatMessage[],
    opts?: ChatOptions | ChatObjectOptions<T>,
  ): Promise<string | T> {
    const model = this.provider.chatModel(opts?.model ?? this.config.chatModel);
    const messagesForModel = this.toModelMessages(messages);

    if (opts && "schema" in opts) {
      // generateObject validates the model output against the schema (the Zod gate of
      // PLAN §2.4); it throws on mismatch, which the pipeline turns into a corrective retry.
      const { object } = await generateObject({
        model,
        schema: opts.schema,
        schemaName: opts.schemaName,
        schemaDescription: opts.schemaDescription,
        messages: messagesForModel,
        temperature: opts.temperature,
        abortSignal: opts.abortSignal,
      });
      return object;
    }

    const { text } = await generateText({
      model,
      messages: messagesForModel,
      temperature: opts?.temperature,
      abortSignal: opts?.abortSignal,
    });
    return text;
  }

  async streamChat(messages: ChatMessage[], opts?: ChatOptions): Promise<AsyncIterable<string>> {
    const result = streamText({
      model: this.provider.chatModel(opts?.model ?? this.config.chatModel),
      messages: this.toModelMessages(messages),
      temperature: opts?.temperature,
      abortSignal: opts?.abortSignal,
    });
    return result.textStream;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const { embeddings } = await embedMany({
      model: this.provider.textEmbeddingModel(this.config.embedModel),
      values: texts,
    });
    return embeddings;
  }

  async listModels(): Promise<string[]> {
    const url = `${this.config.baseURL.replace(/\/+$/, "")}/models`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Model list request failed: ${res.status} ${res.statusText}`);
    }
    const json: unknown = await res.json();
    return ModelsResponse.parse(json).data.map((m) => m.id);
  }
}

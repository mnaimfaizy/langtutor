import "server-only";

import { createOpenAICompatible, type OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import { embedMany, generateText, streamText, type ModelMessage } from "ai";
import { z } from "zod";

import type { LLMConfig } from "./config";
import type { LLMClient } from "./llm-client";
import type { ChatMessage, ChatObjectOptions, ChatOptions } from "./types";

/** Shape of an OpenAI-compatible `GET /models` response (the only field we need). */
const ModelsResponse = z.object({
  data: z.array(z.object({ id: z.string() })),
});

/**
 * Extract the first JSON object from a model text response.
 *
 * Handles three common model output styles:
 *   1. Raw JSON (most instruction-tuned models when prompted correctly)
 *   2. Markdown code fences  (```json … ```)
 *   3. Prose with an embedded {…} block
 *
 * Throws SyntaxError if no parseable JSON is found.
 */
function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    /* continue */
  }
  const fenced = t
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    return JSON.parse(fenced);
  } catch {
    /* continue */
  }
  const match = t.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new SyntaxError(`No JSON object found in model response: ${t.slice(0, 200)}`);
}

/**
 * {@link LLMClient} backed by the Vercel AI SDK against an OpenAI-compatible endpoint
 * (LM Studio, Ollama, or any OpenAI-compatible server — PLAN §1 #4).
 *
 * Structured-output calls use `generateText` + manual JSON extraction rather than
 * `generateObject`, because `generateObject` sends `response_format:{type:'json_object'}`
 * which many local servers (including LM Studio) reject in favour of `json_schema` or `text`.
 * The prompts already instruct the model to emit JSON, so plain text generation is sufficient.
 *
 * Server-only: `import "server-only"` ensures this never reaches the client bundle.
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

  /**
   * Extract a leading system message so it can be passed as the `system` option
   * (recommended by the AI SDK) rather than inside the `messages` array.
   */
  private separateSystem(messages: ChatMessage[]): {
    system: string | undefined;
    rest: ModelMessage[];
  } {
    const [first, ...tail] = messages;
    if (first?.role === "system") {
      return { system: first.content, rest: this.toModelMessages(tail) };
    }
    return { system: undefined, rest: this.toModelMessages(messages) };
  }

  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  chat<T>(messages: ChatMessage[], opts: ChatObjectOptions<T>): Promise<T>;
  async chat<T>(
    messages: ChatMessage[],
    opts?: ChatOptions | ChatObjectOptions<T>,
  ): Promise<string | T> {
    const model = this.provider.chatModel(opts?.model ?? this.config.chatModel);
    const { system, rest } = this.separateSystem(messages);

    if (opts && "schema" in opts) {
      // Use generateText + manual JSON extraction to avoid response_format:json_object,
      // which local servers (LM Studio, some Ollama builds) do not support.
      // The prompts already instruct the model to output JSON, so text mode is sufficient.
      // Default maxTokens to 2048 so Ollama's low num_predict default doesn't truncate JSON.
      const { text } = await generateText({
        model,
        system,
        messages: rest,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens ?? 2048,
        abortSignal: opts.abortSignal,
      });
      return opts.schema.parse(extractJson(text)) as T;
    }

    const { text } = await generateText({
      model,
      system,
      messages: rest,
      temperature: opts?.temperature,
      maxOutputTokens: opts?.maxOutputTokens,
      abortSignal: opts?.abortSignal,
    });
    return text;
  }

  async streamChat(messages: ChatMessage[], opts?: ChatOptions): Promise<AsyncIterable<string>> {
    const { system, rest } = this.separateSystem(messages);
    const result = streamText({
      model: this.provider.chatModel(opts?.model ?? this.config.chatModel),
      system,
      messages: rest,
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

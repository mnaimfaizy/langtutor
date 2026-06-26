import type { z } from "zod";

/** Roles supported on a chat message (no tool/function messages yet). */
export type ChatRole = "system" | "user" | "assistant";

/** A single chat message — storage- and provider-agnostic. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Knobs shared by every chat call. */
export interface ChatOptions {
  /** Override the configured chat model for this call. */
  model?: string;
  temperature?: number;
  abortSignal?: AbortSignal;
  /**
   * Maximum tokens the model may generate. Defaults to 2048 for structured
   * output calls to prevent truncated JSON from Ollama's low num_predict default.
   */
  maxOutputTokens?: number;
}

/**
 * Chat options that request a **Zod-validated structured object** instead of free text.
 * The presence of `schema` is what selects the structured `chat` overload.
 */
export interface ChatObjectOptions<T> extends ChatOptions {
  schema: z.ZodType<T>;
  /** Optional name/description handed to the model to steer the output shape. */
  schemaName?: string;
  schemaDescription?: string;
}

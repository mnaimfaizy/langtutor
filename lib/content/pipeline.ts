import type { ZodType } from "zod";

import type { Cefr, ContentRepository, ContentType, NewContent } from "@/lib/db";
import type { LLMClient } from "@/lib/llm/llm-client";
import type { ChatMessage } from "@/lib/llm/types";

import type {
  ContentValidator,
  GrammarViolation,
  Violation,
  WordViolation,
} from "./content-validator";

// ── public types ──────────────────────────────────────────────────────────────

export interface GenerateOptions<T extends Record<string, unknown>> {
  /** Conversation to send to the LLM on the first attempt. */
  messages: ChatMessage[];
  /** Target CEFR level — used by the validator and stored with the cached row. */
  level: Cefr;
  /** Zod schema describing the expected structured output. */
  schema: ZodType<T>;
  /**
   * Key of the string field in T that contains the prose to validate.
   * For a passage schema `{ body: string }` this would be `"body"`.
   */
  textField: keyof T & string;
  /** Content type stored in the repository. */
  type: ContentType;
  /** Topic tag stored in the repository. */
  topic: string;
  /**
   * Max corrective retries after the initial attempt.
   * Total LLM calls ≤ `maxRetries + 1`.
   * @default 3
   */
  maxRetries?: number;
}

export interface GenerateResult<T> {
  /** The validated, Zod-parsed content object. */
  parsed: T;
  /** IndexedDB id of the newly cached Content row. */
  contentId: number;
}

// ── corrective-retry helpers ──────────────────────────────────────────────────

function buildCorrectiveMessage(violations: Violation[], level: Cefr): ChatMessage {
  const wordParts = violations
    .filter((v): v is WordViolation => v.type === "word")
    .map((v) => `"${v.word}" (${v.wordLevel})`);
  const grammarParts = violations
    .filter((v): v is GrammarViolation => v.type === "grammar")
    .map((v) => `${v.constructionLabel} (${v.constructionLevel})`);

  const details: string[] = [];
  if (wordParts.length) details.push(`vocabulary above ${level}: ${wordParts.join(", ")}`);
  if (grammarParts.length) details.push(`grammar above ${level}: ${grammarParts.join(", ")}`);

  return {
    role: "user",
    content:
      `Please rewrite the text so that all vocabulary and grammar are ` +
      `appropriate for CEFR level ${level}. Issues found — ${details.join("; ")}.`,
  };
}

function violationSummary(violations: Violation[]): string {
  return violations
    .map((v) => (v.type === "word" ? `word:"${v.word}"` : `grammar:"${v.constructionId}"`))
    .join(", ");
}

// ── pipeline ──────────────────────────────────────────────────────────────────

/**
 * Generate-validate-cache pipeline (PLAN §2.4).
 *
 * Loop (max `maxRetries + 1` iterations):
 *   1. Call `llmClient.chat(messages, { schema })` → structured output T.
 *   2. Extract `parsed[textField]` as the prose string.
 *   3. Run `validator.validate(prose, level)`.
 *   4a. Pass → cache to `repository` → return `{ parsed, contentId }`.
 *   4b. Fail, retries remain → append assistant response + corrective user
 *       message → repeat.
 *   4c. Fail, no retries left → throw with violation summary.
 */
export async function generateContent<T extends Record<string, unknown>>(
  opts: GenerateOptions<T>,
  llmClient: LLMClient,
  validator: ContentValidator,
  repository: ContentRepository,
): Promise<GenerateResult<T>> {
  const { messages: initial, level, schema, textField, type, topic, maxRetries = 3 } = opts;

  let messages: ChatMessage[] = [...initial];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let parsed: T;
    try {
      parsed = await llmClient.chat(messages, { schema });
    } catch (err) {
      if (attempt === maxRetries) {
        throw new Error(
          `Content generation failed after ${maxRetries + 1} attempt(s): parse error — ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      // Malformed JSON or schema mismatch — retry with the same messages.
      continue;
    }
    const text = String(parsed[textField] ?? "");
    const validation = validator.validate(text, level);

    if (validation.ok) {
      const row: NewContent = {
        type,
        level,
        topic,
        payload: parsed as Record<string, unknown>,
        source: "generated",
        validatedAt: new Date(),
      };
      const contentId = await repository.putContent(row);
      return { parsed, contentId };
    }

    if (attempt === maxRetries) {
      throw new Error(
        `Content generation failed after ${maxRetries + 1} attempt(s). ` +
          `Remaining violations: ${violationSummary(validation.violations)}`,
      );
    }

    // Build conversation for corrective retry:
    //  • echo the full structured response so the LLM retains all schema fields
    //  • request a rewrite naming the specific violations
    messages = [
      ...messages,
      { role: "assistant", content: JSON.stringify(parsed) },
      buildCorrectiveMessage(validation.violations, level),
    ];
  }

  // Unreachable — loop always returns or throws within the bound
  throw new Error("Unreachable");
}

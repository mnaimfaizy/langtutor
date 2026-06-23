import "server-only";

import { z } from "zod";

import type { DefineFound } from "@/lib/lexicon/define-response";
import type { LLMClient } from "@/lib/llm/llm-client";

const POS_MAP: Record<string, "n" | "v" | "a" | "r"> = {
  n: "n",
  noun: "n",
  v: "v",
  verb: "v",
  a: "a",
  adj: "a",
  adjective: "a",
  r: "r",
  adv: "r",
  adverb: "r",
};

// Tolerant schema: normalises common LLM output variations before validation.
const AgentWordSchema = z.object({
  word: z.string(),
  // LLMs sometimes return an array of definitions; take the first element.
  definition: z
    .union([z.string(), z.array(z.string())])
    .transform((v): string => (Array.isArray(v) ? (v[0] ?? "") : v))
    .pipe(z.string().min(1)),
  examples: z.array(z.string()).min(1).max(5),
  // LLMs may return full words ("noun") instead of the single-char code.
  pos: z.string().transform((s): "n" | "v" | "a" | "r" => POS_MAP[s.toLowerCase()] ?? "n"),
  // LLMs may return verbose strings ("B2 (upper-intermediate)") or omit the field.
  cefr: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((s): "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null => {
      if (s == null) return null;
      const m = s.match(/\b[ABC][12]\b/);
      return m ? (m[0] as "A1" | "A2" | "B1" | "B2" | "C1" | "C2") : null;
    }),
});

const SYSTEM_PROMPT =
  "You are a dictionary assistant. Return JSON with exactly these fields:\n" +
  '- "word": the word as given\n' +
  '- "definition": a single concise string (not an array)\n' +
  '- "examples": array of 1-2 short example sentences\n' +
  '- "pos": exactly one of "n" (noun), "v" (verb), "a" (adjective), "r" (adverb)\n' +
  '- "cefr": exactly one of "A1","A2","B1","B2","C1","C2", or null if unsure';

export async function researchWord(word: string, llmClient: LLMClient): Promise<DefineFound> {
  const result = await llmClient.chat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Define the English word: "${word}"` },
    ],
    { schema: AgentWordSchema },
  );

  return {
    found: true,
    word: result.word || word,
    definition: result.definition,
    examples: result.examples,
    pos: result.pos,
    cefr: result.cefr,
    phonetic: null,
    audioUrl: null,
  };
}

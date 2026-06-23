import { z } from "zod";

export const DefineResponseSchema = z.discriminatedUnion("found", [
  z.object({
    found: z.literal(true),
    word: z.string(),
    definition: z.string(),
    examples: z.array(z.string()),
    cefr: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).nullable(),
    pos: z.enum(["n", "v", "a", "r"]),
    phonetic: z.string().nullable(),
    audioUrl: z.string().nullable(),
  }),
  z.object({
    found: z.literal(false),
    word: z.string(),
  }),
]);

export type DefineResponse = z.infer<typeof DefineResponseSchema>;
export type DefineFound = Extract<DefineResponse, { found: true }>;

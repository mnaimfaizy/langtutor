import { z } from "zod";

import { buildQuestionsMessages, ComprehensionQsSchema } from "@/lib/content/comprehension";
import { getLLMClient } from "@/lib/llm/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(10),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
});

/**
 * `POST /api/reading/questions`
 *
 * Generates multiple-choice comprehension questions for a passage.
 * Body: `{ title, body, level }`
 * Response: `{ questions: ComprehensionQuestion[] }`
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const llmClient = await getLLMClient();
    const messages = buildQuestionsMessages(
      { title: parsed.data.title, body: parsed.data.body },
      parsed.data.level,
    );
    const result = await llmClient.chat(messages, { schema: ComprehensionQsSchema });
    return Response.json(result);
  } catch (error) {
    console.error("[api/reading/questions]", error);
    return Response.json({ error: "Failed to generate questions" }, { status: 502 });
  }
}

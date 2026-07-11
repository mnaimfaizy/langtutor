import { getLLMClient } from "@/lib/llm/server";
import { fillPreA1Exam } from "@/lib/path/exam";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * `POST /api/path/exam/fill`
 *
 * Fills the fixed pre-A1 chapter exam shape via LLMClient (Zod-validated).
 * Does not mark the gate or unlock A1 — that happens only after client-side scoring
 * + `submitPreA1ChapterExam` on pass.
 *
 * Response: `{ exam: PreA1ExamFill }`
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const llmClient = await getLLMClient();
    const exam = await fillPreA1Exam(llmClient);
    return Response.json({ exam });
  } catch (error) {
    console.error("[api/path/exam/fill]", error);
    return Response.json({ error: "Failed to fill chapter exam" }, { status: 502 });
  }
}

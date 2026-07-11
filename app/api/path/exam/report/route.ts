import { getLLMClient } from "@/lib/llm/server";
import {
  generatePreA1TeacherReport,
  TeacherReportRequestSchema,
  TeacherReportSchema,
} from "@/lib/path/exam";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * `POST /api/path/exam/report`
 *
 * Generates a Zod-validated teacher coaching report from a scored pre-A1 exam
 * breakdown (ADR 0038 / 0041, issue #116). Does not change gate unlock — callers
 * submit/score first, then request the report when the provider is reachable.
 *
 * Body: `{ experienceMode, breakdown }`
 * Response: `{ report: TeacherReport }`
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TeacherReportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const llmClient = await getLLMClient();
    const report = await generatePreA1TeacherReport(llmClient, {
      experienceMode: parsed.data.experienceMode,
      breakdown: parsed.data.breakdown,
    });
    // Re-parse at the boundary so a buggy generator cannot leak unvalidated output.
    const validated = TeacherReportSchema.parse(report);
    return Response.json({ report: validated });
  } catch (error) {
    console.error("[api/path/exam/report]", error);
    return Response.json({ error: "Failed to generate teacher report" }, { status: 502 });
  }
}

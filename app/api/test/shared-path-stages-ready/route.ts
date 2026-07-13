import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { getServerContentRepository } from "@/lib/db/server";
import { buildBundledSharedPathStages } from "@/lib/path/shared-path-catalog";

const BodySchema = z.object({
  readyForExam: z.boolean(),
});

/**
 * POST /api/test/shared-path-stages-ready
 *
 * Marks every shared pre-A1 stage ready-for-exam (or not) for e2e mastery-gate specs
 * (issue #128). Seeds missing stage rows from the bundled catalog first.
 * Gated to non-production — returns 404 in production.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await requireUser();

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const repo = await getServerContentRepository();
  let stages = await repo.getSharedPathStages();
  if (stages.length === 0) {
    for (const stage of buildBundledSharedPathStages()) {
      await repo.putSharedPathStage(stage);
    }
    stages = await repo.getSharedPathStages();
  }

  const now = new Date();
  for (const stage of stages) {
    await repo.putSharedPathStage({
      ...stage,
      readyForExam: parsed.data.readyForExam,
      updatedAt: now,
    });
  }

  return Response.json({ ok: true, count: stages.length });
}

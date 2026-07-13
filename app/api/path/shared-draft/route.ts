import { z } from "zod";

import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { getServerContentRepository } from "@/lib/db/server";
import { getLLMClient } from "@/lib/llm/server";
import { fillThinSharedPathStages } from "@/lib/path/shared-path-background-fill";
import { AiDraftableStageIdSchema } from "@/lib/path/shared-unit-draft";
import { draftSharedPathUnit, SharedUnitDraftError } from "@/lib/path/shared-unit-drafter";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const BodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("draft"),
    stageId: AiDraftableStageIdSchema,
  }),
  z.object({
    mode: z.literal("background-fill"),
    maxDrafts: z.number().int().min(1).max(3).optional(),
  }),
]);

/**
 * `POST /api/path/shared-draft` — AI densification into the **shared pending** cache
 * (ADR 0052, issue #131). Admin-only. Never writes learner Unit rows / private paths.
 *
 * Body:
 * - `{ mode: "draft", stageId }` — one pending template for that later stage
 * - `{ mode: "background-fill", maxDrafts? }` — fill thin later stages (shared pending only)
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await resolveCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const [repo, llmClient] = await Promise.all([getServerContentRepository(), getLLMClient()]);

    if (body.mode === "draft") {
      const template = await draftSharedPathUnit(repo, llmClient, body.stageId);
      return Response.json({ template });
    }

    const result = await fillThinSharedPathStages(repo, llmClient, {
      maxDrafts: body.maxDrafts,
    });
    return Response.json(result);
  } catch (error) {
    console.error("[api/path/shared-draft]", error);
    if (error instanceof SharedUnitDraftError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    return Response.json({ error: "Shared path draft failed" }, { status: 502 });
  }
}

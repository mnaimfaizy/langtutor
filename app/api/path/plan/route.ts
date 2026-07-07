import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { getContentRepositoryForUserId } from "@/lib/db/server";
import { getLLMClient } from "@/lib/llm/server";
import { planFutureUnits } from "@/lib/path/teacher-planner";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * `POST /api/path/plan` — LLM-teacher planning for future units (ADR 0015, issue #58).
 * Body: none. Response: `{ plans: Array<{ unitId, title, teacherNote, targetVocab }> }`
 *
 * Plans up to a few unplanned future units per call (backbone-anchored, register selected
 * by the account's experience mode, weakness-aware). This route is the *only* place the
 * planner reaches the Mac (hard rule 1) — persisting a returned plan to its unit is the
 * caller's job via `ContentRepository.updateUnit`, same convention as
 * `/api/reading/generate` and `/api/writing/generate`.
 *
 * Always resolves 200 — an unreachable provider or a corrective-retry failure on a unit
 * simply omits it from `plans`, leaving its backbone placeholder in place. Nothing here
 * ever surfaces an error to the caller; the caller decides what, if anything, to render.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await resolveCurrentUser();
  if (!user) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const repo = await getContentRepositoryForUserId(user.id);
  const profile = await repo.getProfile();
  if (!profile?.cefrLevel) {
    return Response.json({ plans: [] });
  }

  try {
    const [units, weaknesses, llmClient] = await Promise.all([
      repo.getUnits(),
      repo.getWeaknesses(),
      getLLMClient(),
    ]);

    const plans = await planFutureUnits(units, profile, weaknesses, llmClient);
    return Response.json({ plans });
  } catch (error) {
    console.error("[api/path/plan]", error);
    return Response.json({ plans: [] });
  }
}

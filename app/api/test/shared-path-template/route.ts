import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import type { SharedPathUnitTemplate } from "@/lib/db";
import { getServerContentRepository } from "@/lib/db/server";
import { ensureSharedPathCatalogSeeded } from "@/lib/path/shared-path-catalog";

const E2E_PENDING_ID = "pre-a1.phonics.ai-e2e";

const BodySchema = z.object({
  action: z.enum(["put-pending", "purge"]),
  /** Only the fixed e2e draft id is accepted — no arbitrary catalog ids. */
  id: z.literal(E2E_PENDING_ID).optional(),
});

/**
 * POST /api/test/shared-path-template
 *
 * Seeds or purges a shared pending densification draft for e2e (issue #132).
 * Mirrors `/api/test/media-asset` so Playwright can exercise admin approve without
 * calling live Ollama via server actions. Gated to non-production.
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
  await ensureSharedPathCatalogSeeded(repo);

  const id = parsed.data.id ?? E2E_PENDING_ID;

  if (parsed.data.action === "purge") {
    await repo.deleteSharedPathUnitTemplate(id);
    return Response.json({ ok: true, id });
  }

  const now = new Date();
  const existing = await repo.querySharedPathUnitTemplates({ tier: "pre-A1" });
  const pathIndex = existing.length === 0 ? -30 : Math.min(...existing.map((t) => t.pathIndex)) - 1;

  const template: SharedPathUnitTemplate = {
    id,
    tier: "pre-A1",
    stageId: "phonics",
    stageOrder: 1,
    pathIndex,
    title: "Pre-A1: Phonics — E2E draft",
    teacherNote: "E2E seeded shared pending draft for admin approve.",
    activities: [{ skill: "phonics" }],
    richness: "rich",
    approvalStatus: "pending",
    provenance: "ai-draft",
    targetVocab: ["cat", "sat", "mat"],
    createdAt: now,
    updatedAt: now,
  };

  await repo.putSharedPathUnitTemplate(template);
  return Response.json({ ok: true, template });
}

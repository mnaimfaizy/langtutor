import { requireUser } from "@/lib/auth/guards";
import { getServerContentRepository } from "@/lib/db/server";
import { isPreA1Unit } from "@/lib/path/pre-a1";

/**
 * POST /api/test/pre-a1-units-complete
 *
 * Marks every pre-A1 unit completed for the current user and keeps the first A1+
 * unit locked. Used by e2e readiness specs (issue #132) so they do not play through
 * multi-activity Alphabet runways. Gated to non-production.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await requireUser();
  const repo = await getServerContentRepository();
  const units = await repo.getUnits();
  const preA1 = units.filter((u) => isPreA1Unit(u));
  if (preA1.length === 0) {
    return Response.json({ error: "No pre-A1 units seeded" }, { status: 400 });
  }

  for (const unit of preA1) {
    if (unit.status === "completed") continue;
    await repo.updateUnit(unit.id, { status: "completed" });
  }

  const a1Plus = units
    .filter((u) => !isPreA1Unit(u))
    .slice()
    .sort((a, b) => a.index - b.index);
  const firstA1 = a1Plus[0];
  if (firstA1 && firstA1.status !== "locked") {
    await repo.updateUnit(firstA1.id, { status: "locked" });
  }

  return Response.json({
    ok: true,
    completed: preA1.length,
    lockedA1Index: firstA1?.index ?? null,
  });
}

import { eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth/guards";
import { getDrizzleClient } from "@/lib/db/drizzle/client";
import { errorEvents } from "@/lib/db/drizzle/schema";

/**
 * GET /api/test/error-events/count
 *
 * Returns `{ count }` — the number of errorEvents persisted for the current
 * user in SQLite. Used by comprehension.spec to verify mistakes are persisted
 * (replacing the obsolete IndexedDB read from the v1 architecture).
 *
 * Gated to non-production environments — returns 404 in production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const user = await requireUser();
  const db = getDrizzleClient();
  const rows = db.select().from(errorEvents).where(eq(errorEvents.userId, user.id)).all();

  return Response.json({ count: rows.length });
}

import "server-only";

import { requireUser } from "@/lib/auth/guards";
import { getDrizzleClient } from "./drizzle/client";
import { SqliteContentRepository } from "./sqlite-content-repository";

/**
 * Server-only composition root for the SQLite-backed {@link SqliteContentRepository}.
 * Resolves the current user from the session cookie and scopes the repository to that user.
 * Redirects to /login (via requireUser) if the session is absent or expired.
 */
export async function getServerContentRepository(): Promise<SqliteContentRepository> {
  const user = await requireUser();
  return new SqliteContentRepository(getDrizzleClient(), user.id);
}

import "server-only";

import { getDrizzleClient } from "./drizzle/client";
import { SqliteContentRepository } from "./sqlite-content-repository";
import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";

/**
 * Server-only composition root for the SQLite-backed {@link SqliteContentRepository}.
 * Resolves the current user from the session cookie and scopes the repository to that user.
 * Throws if no authenticated session is found.
 */
export async function getServerContentRepository(): Promise<SqliteContentRepository> {
  const user = await resolveCurrentUser();
  if (!user) throw new Error("Unauthenticated");
  return new SqliteContentRepository(getDrizzleClient(), user.id);
}

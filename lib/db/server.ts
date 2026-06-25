import "server-only";

import { getDrizzleClient } from "./drizzle/client";
import { SqliteContentRepository } from "./sqlite-content-repository";
import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";

/**
 * Server-only composition root for the SQLite-backed {@link SqliteContentRepository}.
 * Call from route handlers and server actions; never import from client components.
 *
 * @param request - Optional incoming request, passed to {@link resolveCurrentUser}
 *   to scope the repository to the current user.
 */
export function getServerContentRepository(request?: Request): SqliteContentRepository {
  const userId = resolveCurrentUser(request);
  return new SqliteContentRepository(getDrizzleClient(), userId);
}

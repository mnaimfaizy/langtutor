import "server-only";

import { requireUser } from "@/lib/auth/guards";
import { env } from "@/lib/config/env";

import type { ContentRepository } from "./content-repository";
import { getDrizzleClient } from "./drizzle/client";
import { getPostgresDrizzleClient } from "./drizzle/postgres-client";
import { SqliteContentRepository } from "./sqlite-content-repository";
import { SupabaseContentRepository } from "./supabase-content-repository";

/**
 * Server-only composition root for the {@link ContentRepository}.
 * Wires {@link SqliteContentRepository} (local) or {@link SupabaseContentRepository}
 * (cloud) based on `LANGTUTOR_MODE`. Resolves the current user from the session and
 * scopes the repository to that user. Redirects to /login (via requireUser) if the
 * session is absent or expired.
 */
export async function getServerContentRepository(): Promise<ContentRepository> {
  const user = await requireUser();

  if (env.LANGTUTOR_MODE === "cloud") {
    const db = await getPostgresDrizzleClient();
    return new SupabaseContentRepository(db, user.id);
  }

  return new SqliteContentRepository(getDrizzleClient(), user.id);
}

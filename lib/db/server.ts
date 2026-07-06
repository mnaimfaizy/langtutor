import "server-only";

import { requireUser } from "@/lib/auth/guards";
import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { env } from "@/lib/config/env";

import type { ContentRepository } from "./content-repository";
import { getDrizzleClient } from "./drizzle/client";
import { getPostgresDrizzleClient } from "./drizzle/postgres-client";
import { DEFAULT_EXPERIENCE_MODE, type ExperienceMode } from "./schema";
import { SqliteContentRepository } from "./sqlite-content-repository";
import { SupabaseContentRepository } from "./supabase-content-repository";

async function repositoryForUserId(userId: string): Promise<ContentRepository> {
  if (env.LANGTUTOR_MODE === "cloud") {
    const db = await getPostgresDrizzleClient();
    return new SupabaseContentRepository(db, userId);
  }

  return new SqliteContentRepository(getDrizzleClient(), userId);
}

/**
 * Server-only composition root for the {@link ContentRepository}.
 * Wires {@link SqliteContentRepository} (local) or {@link SupabaseContentRepository}
 * (cloud) based on `LANGTUTOR_MODE`. Resolves the current user from the session and
 * scopes the repository to that user. Redirects to /login (via requireUser) if the
 * session is absent or expired.
 */
export async function getServerContentRepository(): Promise<ContentRepository> {
  const user = await requireUser();
  return repositoryForUserId(user.id);
}

/**
 * Resolves the signed-in user's stored {@link ExperienceMode} without redirecting when
 * signed out (unlike {@link getServerContentRepository}). Used by the root layout to seed
 * the palette-bootstrap inline script server-side so first paint already reflects the
 * account's mode — no flash while the client re-fetches it. Falls back to
 * {@link DEFAULT_EXPERIENCE_MODE} for signed-out visitors, pre-onboarding profiles, and
 * on any lookup failure (e.g. DB not yet reachable).
 */
export async function getCurrentExperienceMode(): Promise<ExperienceMode> {
  const user = await resolveCurrentUser();
  if (!user) return DEFAULT_EXPERIENCE_MODE;

  try {
    const repo = await repositoryForUserId(user.id);
    const profile = await repo.getProfile();
    return profile?.experienceMode ?? DEFAULT_EXPERIENCE_MODE;
  } catch {
    return DEFAULT_EXPERIENCE_MODE;
  }
}

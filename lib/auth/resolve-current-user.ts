import "server-only";

import { cookies } from "next/headers";

import type { AuthUser } from "./auth-provider";
import { SESSION_COOKIE } from "./constants";
import { getAuthProvider } from "./server";

export { SESSION_COOKIE };

/**
 * Resolves the current user from the session cookie.
 * Returns the authenticated {@link AuthUser} for a valid, non-expired session,
 * or `null` if the cookie is absent or the session is expired/unknown.
 */
export async function resolveCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  return getAuthProvider().getCurrentUser(sessionId);
}

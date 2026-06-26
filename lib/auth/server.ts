import "server-only";

import { getDrizzleClient } from "@/lib/db/drizzle/client";

import type { AuthProvider } from "./auth-provider";
import { LocalAuthProvider } from "./local-auth-provider";

let _authProvider: AuthProvider | null = null;

/**
 * Server-only composition root for the auth seam.
 * Returns the singleton {@link LocalAuthProvider} for the current LANGTUTOR_MODE.
 * Call only from route handlers — never import from client components.
 */
export function getAuthProvider(): AuthProvider {
  if (!_authProvider) {
    _authProvider = new LocalAuthProvider(getDrizzleClient());
  }
  return _authProvider;
}

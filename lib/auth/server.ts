import "server-only";

import { env } from "@/lib/config/env";
import { getDrizzleClient } from "@/lib/db/drizzle/client";

import type { AuthProvider } from "./auth-provider";
import { LocalAuthProvider } from "./local-auth-provider";
import { SupabaseAuthProvider } from "./supabase-auth-provider";

let _authProvider: AuthProvider | null = null;

/**
 * Server-only composition root for the auth seam.
 * Returns the singleton auth provider for the current LANGTUTOR_MODE.
 * Call only from route handlers — never import from client components.
 */
export function getAuthProvider(): AuthProvider {
  if (!_authProvider) {
    _authProvider =
      env.LANGTUTOR_MODE === "cloud"
        ? new SupabaseAuthProvider()
        : new LocalAuthProvider(getDrizzleClient());
  }
  return _authProvider;
}

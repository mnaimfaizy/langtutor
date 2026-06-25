import { BOOTSTRAP_ADMIN_ID } from "@/lib/db/drizzle/schema";

/**
 * Resolves the current user id from the request. Phase 1a stub — always returns the
 * bootstrap admin. Phase 1b will replace this with a real session lookup.
 */
export function resolveCurrentUser(_request?: Request): string {
  return BOOTSTRAP_ADMIN_ID;
}

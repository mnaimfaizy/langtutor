import type { AuthUser } from "./auth-provider";

/** Where an authenticated visitor lands after hitting the public root. */
export const HOME_PATH = "/home";

/**
 * Decides what the root route ("/") should do for a given visitor.
 * Authenticated visitors are sent on to the learning home; anonymous visitors
 * get `null`, meaning: render the public marketing shell in place.
 */
export function resolveRootRedirect(user: AuthUser | null): string | null {
  return user ? HOME_PATH : null;
}

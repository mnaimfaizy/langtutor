import { z } from "zod";

import { USER_ROLE_VALUES } from "@/lib/db/drizzle/schema";

export type UserRole = (typeof USER_ROLE_VALUES)[number];

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(USER_ROLE_VALUES),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export interface AuthProvider {
  /** Returns the authenticated user for a valid, non-expired session; null otherwise. */
  getCurrentUser(sessionId: string): Promise<AuthUser | null>;
  /** Verifies credentials and creates a new session. Throws on bad credentials. */
  signIn(email: string, password: string): Promise<{ sessionId: string; user: AuthUser }>;
  /** Destroys the session. No-op if session does not exist. */
  signOut(sessionId: string): Promise<void>;
  /** Creates a new user. Admin-only by convention — callers must enforce. */
  createUser(email: string, password: string, role?: UserRole): Promise<AuthUser>;
  /** Lists all users. Admin-only by convention. */
  listUsers(): Promise<AuthUser[]>;
  /** Deletes a user and all their sessions. Admin-only by convention. */
  deleteUser(userId: string): Promise<void>;
}

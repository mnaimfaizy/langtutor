import "server-only";

import { redirect } from "next/navigation";

import type { AuthUser } from "./auth-provider";
import { resolveCurrentUser } from "./resolve-current-user";

/**
 * Resolves the current user or redirects to /login.
 * Use in server components and server actions that require authentication.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await resolveCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Resolves the current user and asserts admin role, or redirects to /login.
 * Use in server components and server actions that require admin access.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/login");
  return user;
}

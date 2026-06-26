"use server";

import { z } from "zod";

import type { AuthUser, UserRole } from "@/lib/auth/auth-provider";
import { requireAdmin } from "@/lib/auth/guards";
import { getAuthProvider } from "@/lib/auth/server";

export async function listUsers(): Promise<AuthUser[]> {
  await requireAdmin();
  return getAuthProvider().listUsers();
}

const CreateUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "standard"]).default("standard"),
});

export async function createUser(
  email: string,
  password: string,
  role: UserRole,
): Promise<AuthUser> {
  await requireAdmin();
  const input = CreateUserSchema.parse({ email, password, role });
  return getAuthProvider().createUser(input.email, input.password, input.role);
}

export async function deleteUser(userId: string): Promise<void> {
  await requireAdmin();
  z.string().uuid("Invalid user ID").parse(userId);
  await getAuthProvider().deleteUser(userId);
}

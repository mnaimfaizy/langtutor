import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/lib/config/env";
import type { PostgresDrizzleClient } from "@/lib/db/drizzle/postgres-client";
import { getPostgresDrizzleClient } from "@/lib/db/drizzle/postgres-client";
import { users } from "@/lib/db/drizzle/schema.postgres";

import type { AuthProvider, AuthUser, UserRole } from "./auth-provider";
import { authUserSchema } from "./auth-provider";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "standard"]).default("standard"),
});

const supabaseUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});

const supabaseSessionSchema = z.object({
  access_token: z.string().min(1),
  user: supabaseUserSchema,
});

const supabaseAuthUserResponseSchema = z.object({
  user: supabaseUserSchema.nullable(),
});

type SupabaseClients = {
  anon: SupabaseClient;
  admin: SupabaseClient;
};

function createSupabaseClients(): SupabaseClients {
  if (env.LANGTUTOR_MODE !== "cloud") {
    throw new Error("SupabaseAuthProvider requires LANGTUTOR_MODE=cloud");
  }

  const common = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  } as const;

  return {
    anon: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, common),
    admin: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, common),
  };
}

async function loadUserRole(db: PostgresDrizzleClient, userId: string): Promise<UserRole | null> {
  const rows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const role = rows[0]?.role;
  if (role === "admin" || role === "standard") return role;
  return null;
}

function toAuthUser(id: string, email: string, role: UserRole): AuthUser {
  return authUserSchema.parse({ id, email, role });
}

export class SupabaseAuthProvider implements AuthProvider {
  private readonly clients: SupabaseClients;
  private db: PostgresDrizzleClient | null = null;
  private readonly ready: Promise<void>;

  constructor(clients: SupabaseClients = createSupabaseClients()) {
    this.clients = clients;
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    this.db = await getPostgresDrizzleClient();
    await this.bootstrapAdminIfNeeded(this.db);
  }

  private async ensureReady(): Promise<PostgresDrizzleClient> {
    await this.ready;
    if (!this.db) throw new Error("Supabase auth provider failed to initialize");
    return this.db;
  }

  private async bootstrapAdminIfNeeded(db: PostgresDrizzleClient): Promise<void> {
    if (env.LANGTUTOR_MODE !== "cloud") return;

    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length > 0) return;

    const { data, error } = await this.clients.admin.auth.admin.createUser({
      email: env.LANGTUTOR_ADMIN_EMAIL,
      password: env.LANGTUTOR_ADMIN_PASSWORD,
      email_confirm: true,
    });

    if (error) throw new Error(`Admin bootstrap failed: ${error.message}`);

    const authUser = supabaseUserSchema.parse(data.user);

    await db.insert(users).values({
      id: authUser.id,
      email: authUser.email,
      role: "admin",
      createdAt: new Date(),
    });
  }

  async getCurrentUser(sessionId: string): Promise<AuthUser | null> {
    await this.ensureReady();

    const { data, error } = await this.clients.anon.auth.getUser(sessionId);
    if (error || !data.user) return null;

    const authUser = supabaseAuthUserResponseSchema.parse(data).user;
    if (!authUser) return null;

    const role = await loadUserRole(this.db!, authUser.id);
    if (!role) return null;

    return toAuthUser(authUser.id, authUser.email, role);
  }

  async signIn(email: string, password: string): Promise<{ sessionId: string; user: AuthUser }> {
    const db = await this.ensureReady();
    const input = signInSchema.parse({ email, password });

    const { data, error } = await this.clients.anon.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.session) throw new Error("Invalid credentials");

    const session = supabaseSessionSchema.parse(data.session);
    const role = await loadUserRole(db, session.user.id);
    if (!role) throw new Error("Invalid credentials");

    return {
      sessionId: session.access_token,
      user: toAuthUser(session.user.id, session.user.email, role),
    };
  }

  async signOut(_sessionId: string): Promise<void> {
    await this.ensureReady();
    // Session invalidation is handled by clearing the httpOnly cookie in the route handler.
  }

  async createUser(
    email: string,
    password: string,
    role: UserRole = "standard",
  ): Promise<AuthUser> {
    const db = await this.ensureReady();
    const input = createUserSchema.parse({ email, password, role });

    const { data, error } = await this.clients.admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });

    if (error) throw new Error(`Failed to create user: ${error.message}`);

    const authUser = supabaseUserSchema.parse(data.user);

    await db.insert(users).values({
      id: authUser.id,
      email: authUser.email,
      role: input.role,
      createdAt: new Date(),
    });

    return toAuthUser(authUser.id, authUser.email, input.role);
  }

  async listUsers(): Promise<AuthUser[]> {
    const db = await this.ensureReady();
    const rows = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users);
    return rows.map((row) => toAuthUser(row.id, row.email, row.role as UserRole));
  }

  async deleteUser(userId: string): Promise<void> {
    const db = await this.ensureReady();
    z.string().uuid().parse(userId);

    const target = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (target[0]?.role === "admin") {
      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));

      if (admins.length <= 1) {
        throw new Error("Cannot delete the last admin");
      }
    }

    const { error } = await this.clients.admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Failed to delete user: ${error.message}`);

    await db.delete(users).where(eq(users.id, userId));
  }

  async createBootstrapAdmin(_email: string, _password: string): Promise<AuthUser> {
    await this.ensureReady();
    throw new Error(
      "Cloud mode bootstraps the admin from LANGTUTOR_ADMIN_* env vars on first boot",
    );
  }
}

import "server-only";

import { hash, verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { DrizzleClient } from "@/lib/db/drizzle/client";
import { BOOTSTRAP_ADMIN_ID, sessions, users } from "@/lib/db/drizzle/schema";

import type { AuthProvider, AuthUser, UserRole } from "./auth-provider";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Permissive format-only check — accepts BOOTSTRAP_ADMIN_ID (version digit 0) and crypto.randomUUID() output.
const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(UUID_FORMAT, "Invalid ID format");

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "standard"]).default("standard"),
});

export class LocalAuthProvider implements AuthProvider {
  constructor(private readonly db: DrizzleClient) {}

  async getCurrentUser(sessionId: string): Promise<AuthUser | null> {
    if (!uuidSchema.safeParse(sessionId).success) return null;
    const row = this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, sessionId))
      .get();

    if (!row) return null;

    if (row.expiresAt < new Date()) {
      this.db.delete(sessions).where(eq(sessions.id, sessionId)).run();
      return null;
    }

    return { id: row.id, email: row.email, role: row.role as UserRole };
  }

  async signIn(email: string, password: string): Promise<{ sessionId: string; user: AuthUser }> {
    const input = signInSchema.parse({ email, password });

    const user = this.db.select().from(users).where(eq(users.email, input.email)).get();

    if (!user) throw new Error("Invalid credentials");

    const valid = await verify(user.passwordHash, input.password);
    if (!valid) throw new Error("Invalid credentials");

    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    this.db
      .insert(sessions)
      .values({ id: sessionId, userId: user.id, expiresAt, createdAt: now })
      .run();

    return {
      sessionId,
      user: { id: user.id, email: user.email, role: user.role as UserRole },
    };
  }

  async signOut(sessionId: string): Promise<void> {
    uuidSchema.parse(sessionId);
    this.db.delete(sessions).where(eq(sessions.id, sessionId)).run();
  }

  async createUser(
    email: string,
    password: string,
    role: UserRole = "standard",
  ): Promise<AuthUser> {
    const input = createUserSchema.parse({ email, password, role });

    const passwordHash = await hash(input.password);
    const userId = crypto.randomUUID();
    const now = new Date();

    this.db
      .insert(users)
      .values({ id: userId, email: input.email, passwordHash, role: input.role, createdAt: now })
      .run();

    return { id: userId, email: input.email, role: input.role };
  }

  async listUsers(): Promise<AuthUser[]> {
    return this.db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .all()
      .map((row) => ({ ...row, role: row.role as UserRole }));
  }

  async deleteUser(userId: string): Promise<void> {
    uuidSchema.parse(userId);
    const target = this.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (target?.role === "admin") {
      const admins = this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"))
        .all();
      if (admins.length <= 1) {
        throw new Error("Cannot delete the last admin");
      }
    }
    this.db.delete(users).where(eq(users.id, userId)).run();
  }

  async createBootstrapAdmin(email: string, password: string): Promise<AuthUser> {
    const existing = this.db.select({ id: users.id }).from(users).limit(1).get();
    if (existing) throw new Error("Bootstrap admin already exists — users table is not empty");

    const input = createUserSchema.parse({ email, password, role: "admin" });
    const passwordHash = await hash(input.password);
    const now = new Date();

    this.db
      .insert(users)
      .values({
        id: BOOTSTRAP_ADMIN_ID,
        email: input.email,
        passwordHash,
        role: "admin",
        createdAt: now,
      })
      .run();

    return { id: BOOTSTRAP_ADMIN_ID, email: input.email, role: "admin" };
  }
}

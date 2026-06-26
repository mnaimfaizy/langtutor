import "server-only";

import { hash, verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { DrizzleClient } from "@/lib/db/drizzle/client";
import { sessions, users } from "@/lib/db/drizzle/schema";

import type { AuthProvider, AuthUser, UserRole } from "./auth-provider";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
    this.db.delete(users).where(eq(users.id, userId)).run();
  }
}

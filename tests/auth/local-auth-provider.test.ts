import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import * as schema from "@/lib/db/drizzle/schema";
import { BOOTSTRAP_ADMIN_ID } from "@/lib/db/drizzle/schema";
import { LocalAuthProvider } from "@/lib/auth/local-auth-provider";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle/migrations");

let sqlite: ReturnType<typeof Database>;
let provider: LocalAuthProvider;

beforeEach(() => {
  sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  provider = new LocalAuthProvider(db);
});

afterEach(() => {
  sqlite.close();
});

describe("createUser / password hash round-trip", () => {
  it("creates a user and signIn succeeds with the correct password", async () => {
    const user = await provider.createUser("alice@example.com", "hunter2hunter");
    expect(user.email).toBe("alice@example.com");
    expect(user.role).toBe("standard");

    const { sessionId, user: signed } = await provider.signIn("alice@example.com", "hunter2hunter");
    expect(sessionId).toBeTruthy();
    expect(signed.id).toBe(user.id);
  });

  it("rejects a wrong password", async () => {
    await provider.createUser("bob@example.com", "correctPassword1");
    await expect(provider.signIn("bob@example.com", "wrongPassword")).rejects.toThrow(
      "Invalid credentials",
    );
  });

  it("creates an admin user when role is specified", async () => {
    const user = await provider.createUser("admin@example.com", "adminPass99", "admin");
    expect(user.role).toBe("admin");
  });
});

describe("session lifecycle", () => {
  it("getCurrentUser returns the user for a valid session", async () => {
    await provider.createUser("carol@example.com", "passWord123");
    const { sessionId, user } = await provider.signIn("carol@example.com", "passWord123");

    const resolved = await provider.getCurrentUser(sessionId);
    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe(user.id);
    expect(resolved!.email).toBe("carol@example.com");
  });

  it("getCurrentUser returns null for an unknown session id", async () => {
    const resolved = await provider.getCurrentUser("00000000-0000-0000-0000-000000000099");
    expect(resolved).toBeNull();
  });

  it("getCurrentUser returns null and cleans up an expired session", async () => {
    await provider.createUser("dave@example.com", "passWord123");
    const { sessionId } = await provider.signIn("dave@example.com", "passWord123");

    const db = drizzle(sqlite, { schema });
    db.update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .run();

    const resolved = await provider.getCurrentUser(sessionId);
    expect(resolved).toBeNull();

    const again = await provider.getCurrentUser(sessionId);
    expect(again).toBeNull();
  });

  it("signOut destroys the session", async () => {
    await provider.createUser("eve@example.com", "passWord123");
    const { sessionId } = await provider.signIn("eve@example.com", "passWord123");

    await provider.signOut(sessionId);

    const resolved = await provider.getCurrentUser(sessionId);
    expect(resolved).toBeNull();
  });
});

describe("createBootstrapAdmin", () => {
  it("creates admin with BOOTSTRAP_ADMIN_ID and allows sign-in", async () => {
    const user = await provider.createBootstrapAdmin("admin@example.com", "adminPass99");
    expect(user.id).toBe(BOOTSTRAP_ADMIN_ID);
    expect(user.role).toBe("admin");
    expect(user.email).toBe("admin@example.com");

    const { sessionId } = await provider.signIn("admin@example.com", "adminPass99");
    const resolved = await provider.getCurrentUser(sessionId);
    expect(resolved?.id).toBe(BOOTSTRAP_ADMIN_ID);
  });

  it("throws if any users already exist", async () => {
    await provider.createUser("other@example.com", "passWord123");
    await expect(provider.createBootstrapAdmin("admin@example.com", "adminPass99")).rejects.toThrow(
      "Bootstrap admin already exists",
    );
  });
});

describe("listUsers / deleteUser", () => {
  it("listUsers returns all created users", async () => {
    await provider.createUser("u1@example.com", "passWord123");
    await provider.createUser("u2@example.com", "passWord123");

    const list = await provider.listUsers();
    const emails = list.map((u) => u.email);
    expect(emails).toContain("u1@example.com");
    expect(emails).toContain("u2@example.com");
  });

  it("deleteUser removes the user and their sessions", async () => {
    const user = await provider.createUser("frank@example.com", "passWord123");
    const { sessionId } = await provider.signIn("frank@example.com", "passWord123");

    await provider.deleteUser(user.id);

    const list = await provider.listUsers();
    expect(list.find((u) => u.id === user.id)).toBeUndefined();

    const resolved = await provider.getCurrentUser(sessionId);
    expect(resolved).toBeNull();
  });

  it("deleteUser allows deleting a standard user", async () => {
    await provider.createUser("admin@example.com", "adminPass99", "admin");
    const standard = await provider.createUser("user@example.com", "userPass99");

    await provider.deleteUser(standard.id);

    const list = await provider.listUsers();
    expect(list.find((u) => u.id === standard.id)).toBeUndefined();
  });
});

describe("last-admin protection", () => {
  it("prevents deleting the last admin", async () => {
    const admin = await provider.createUser("admin@example.com", "adminPass99", "admin");
    await expect(provider.deleteUser(admin.id)).rejects.toThrow("Cannot delete the last admin");
  });

  it("allows deleting an admin when another admin exists", async () => {
    const admin1 = await provider.createUser("admin1@example.com", "adminPass99", "admin");
    const admin2 = await provider.createUser("admin2@example.com", "adminPass99", "admin");

    await provider.deleteUser(admin1.id);

    const list = await provider.listUsers();
    expect(list.find((u) => u.id === admin1.id)).toBeUndefined();
    expect(list.find((u) => u.id === admin2.id)).toBeDefined();
  });

  it("does not block deleting a non-existent user id", async () => {
    await expect(
      provider.deleteUser("00000000-0000-0000-0000-000000000099"),
    ).resolves.toBeUndefined();
  });
});

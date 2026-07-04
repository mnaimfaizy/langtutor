import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { RLS_APP_ROLE, withUserRlsScope } from "@/lib/db/drizzle/postgres-rls-scope";
import * as schema from "@/lib/db/drizzle/schema.postgres";
import { profiles as profilesTable } from "@/lib/db/drizzle/schema.postgres";
import { SupabaseContentRepository } from "@/lib/db/supabase-content-repository";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle/postgres/migrations");
const RLS_MIGRATION_PATH = path.join(MIGRATIONS_FOLDER, "0001_enable_rls.sql");

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

async function isPostgresAvailable(): Promise<boolean> {
  let sqlClient: ReturnType<typeof postgres> | undefined;
  try {
    sqlClient = postgres(DATABASE_URL, { max: 1, connect_timeout: 2 });
    await sqlClient`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sqlClient?.end();
  }
}

const postgresAvailable = await isPostgresAvailable();

describe("Postgres RLS migration", () => {
  it("enables RLS policies on all per-user tables", () => {
    const migration = readFileSync(RLS_MIGRATION_PATH, "utf8");
    const perUserTables = ["profile", "cards", "error_events", "weakness", "gamification"];

    for (const table of perUserTables) {
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      expect(migration).toContain(`current_setting('request.jwt.claim.sub', true)`);
    }

    expect(migration).toContain(`CREATE ROLE ${RLS_APP_ROLE}`);
  });
});

describe.skipIf(!postgresAvailable)("Postgres RLS enforcement", () => {
  let sqlClient: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    sqlClient = postgres(DATABASE_URL, { max: 1 });
    db = drizzle(sqlClient, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    await sqlClient`DELETE FROM profile WHERE user_id IN (${USER_A}::uuid, ${USER_B}::uuid)`;
  });

  afterAll(async () => {
    await sqlClient`DELETE FROM profile WHERE user_id IN (${USER_A}::uuid, ${USER_B}::uuid)`;
    await sqlClient.end();
  });

  it("blocks unscoped reads on per-user tables", async () => {
    await sqlClient`
      INSERT INTO profile (user_id, goals, created_at, settings)
      VALUES (${USER_A}::uuid, '[]', NOW(), '{}')
    `;

    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_APP_ROLE}`));
      return tx.select().from(profilesTable);
    });

    expect(rows).toHaveLength(0);
  });

  it("blocks unscoped inserts on per-user tables", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_APP_ROLE}`));
        await tx.insert(profilesTable).values({
          userId: USER_B,
          goals: "[]",
          createdAt: new Date(),
          settings: "{}",
        });
      }),
    ).rejects.toThrow(/row-level security|RLS/i);
  });

  it("allows scoped repository operations for the session user", async () => {
    const repo = new SupabaseContentRepository(db, USER_A);

    await repo.saveProfile({
      cefrLevel: "A2",
      goals: [],
      createdAt: new Date(),
      settings: {},
    });

    const profile = await repo.getProfile();
    expect(profile?.cefrLevel).toBe("A2");
  });

  it("isolates users via RLS even when app filters are wrong", async () => {
    const repoA = new SupabaseContentRepository(db, USER_A);
    const repoB = new SupabaseContentRepository(db, USER_B);

    await repoA.saveProfile({
      cefrLevel: "B1",
      goals: [],
      createdAt: new Date(),
      settings: { macLlmModel: "user-a-model" },
    });

    expect(await repoB.getProfile()).toBeUndefined();
  });

  it("withUserRlsScope injects request.jwt.claim.sub for the transaction", async () => {
    const sub = await withUserRlsScope(db, USER_A, async (tx) => {
      const rows = await tx.execute(
        sql`SELECT current_setting('request.jwt.claim.sub', true) AS sub`,
      );
      return rows[0]?.sub as string;
    });

    expect(sub).toBe(USER_A);
  });
});

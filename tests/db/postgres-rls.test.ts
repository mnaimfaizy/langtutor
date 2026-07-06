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
const PER_USER_TABLES = ["profile", "cards", "error_events", "weakness", "gamification"];
const PER_USER_TABLES_SQL = PER_USER_TABLES.map((table) => `'${table}'`).join(", ");

async function cleanupPerUserRows(sqlClient: ReturnType<typeof postgres>): Promise<void> {
  await sqlClient`DELETE FROM gamification WHERE user_id IN (${USER_A}::uuid, ${USER_B}::uuid)`;
  await sqlClient`DELETE FROM weakness WHERE user_id IN (${USER_A}::uuid, ${USER_B}::uuid)`;
  await sqlClient`DELETE FROM error_events WHERE user_id IN (${USER_A}::uuid, ${USER_B}::uuid)`;
  await sqlClient`DELETE FROM cards WHERE user_id IN (${USER_A}::uuid, ${USER_B}::uuid)`;
  await sqlClient`DELETE FROM profile WHERE user_id IN (${USER_A}::uuid, ${USER_B}::uuid)`;
}

async function seedPerUserRows(sqlClient: ReturnType<typeof postgres>): Promise<void> {
  await cleanupPerUserRows(sqlClient);

  await sqlClient`
    INSERT INTO profile (user_id, goals, created_at, settings)
    VALUES (${USER_A}::uuid, '[]', NOW(), '{}')
  `;

  await sqlClient`
    INSERT INTO cards (user_id, word, definition, examples, cefr, fsrs, due_at, created_at)
    VALUES (
      ${USER_A}::uuid,
      'anchor',
      'test definition',
      '["example"]',
      'A1',
      '{"due":"2026-01-01T00:00:00.000Z","stability":1,"difficulty":1,"elapsedDays":0,"scheduledDays":0,"reps":0,"lapses":0,"state":0}',
      NOW(),
      NOW()
    )
  `;

  await sqlClient`
    INSERT INTO error_events (user_id, skill, category, cefr, context, created_at)
    VALUES (${USER_A}::uuid, 'reading', 'articles', 'A1', 'seed context', NOW())
  `;

  await sqlClient`
    INSERT INTO weakness (user_id, skill, category, cefr, score, confidence, updated_at)
    VALUES (${USER_A}::uuid, 'reading', 'articles', 'A1', 0.5, 0.75, NOW())
  `;

  await sqlClient`
    INSERT INTO gamification (user_id, xp, level, streak_count, last_activity_date, achievements)
    VALUES (${USER_A}::uuid, 10, 2, 3, '2026-07-04', '[]')
  `;
}

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

    for (const table of PER_USER_TABLES) {
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

    await cleanupPerUserRows(sqlClient);
  });

  afterAll(async () => {
    await cleanupPerUserRows(sqlClient);
    await sqlClient.end();
  });

  it("enables and forces RLS on all per-user tables in the database", async () => {
    const rows = await sqlClient.unsafe<
      Array<{
        table_name: string;
        rls_enabled: boolean;
        rls_forced: boolean;
        policy_count: number;
      }>
    >(
      `SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced,
        COUNT(p.policyname)::int AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
      WHERE n.nspname = 'public'
        AND c.relname IN (${PER_USER_TABLES_SQL})
      GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
      ORDER BY c.relname`,
    );

    expect(rows).toHaveLength(PER_USER_TABLES.length);
    for (const row of rows) {
      expect(row.rls_enabled).toBe(true);
      expect(row.rls_forced).toBe(true);
      expect(row.policy_count).toBeGreaterThan(0);
    }
  });

  it("blocks unscoped reads on per-user tables", async () => {
    await seedPerUserRows(sqlClient);

    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_APP_ROLE}`));
      return tx.select().from(profilesTable);
    });

    expect(rows).toHaveLength(0);
  });

  it("blocks unscoped direct SQL reads across all protected tables", async () => {
    await seedPerUserRows(sqlClient);

    const counts = await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_APP_ROLE}`));

      const results: Record<string, number> = {};
      for (const table of PER_USER_TABLES) {
        const rows = await tx.execute(sql.raw(`SELECT COUNT(*)::int AS count FROM "${table}"`));
        results[table] = Number(rows[0]?.count ?? 0);
      }
      return results;
    });

    expect(counts).toEqual({
      profile: 0,
      cards: 0,
      error_events: 0,
      weakness: 0,
      gamification: 0,
    });
  });

  it("blocks unscoped inserts on per-user tables", async () => {
    const error = await db
      .transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_APP_ROLE}`));
        await tx.insert(profilesTable).values({
          userId: USER_B,
          goals: "[]",
          createdAt: new Date(),
          settings: "{}",
        });
      })
      .catch(
        (error_: unknown) => error_ as Error & { cause?: { code?: string; message?: string } },
      );

    expect(error).toBeInstanceOf(Error);
    expect(error?.cause?.code).toBe("42501");
    expect(error?.cause?.message).toMatch(/row-level security|RLS/i);
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

  it("round-trips experienceMode for the session user (issue #45)", async () => {
    const repo = new SupabaseContentRepository(db, USER_A);

    await repo.saveProfile({
      cefrLevel: "A2",
      goals: [],
      createdAt: new Date(),
      settings: {},
      experienceMode: "kid",
    });

    expect((await repo.getProfile())?.experienceMode).toBe("kid");

    await repo.saveProfile({
      cefrLevel: "A2",
      goals: [],
      createdAt: new Date(),
      settings: {},
      experienceMode: "adult",
    });

    expect((await repo.getProfile())?.experienceMode).toBe("adult");
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

  it("blocks mismatched claims from reading another user's rows across all protected tables", async () => {
    await seedPerUserRows(sqlClient);

    const counts = await withUserRlsScope(db, USER_B, async (tx) => {
      const results: Record<string, number> = {};
      for (const table of PER_USER_TABLES) {
        const rows = await tx.execute(
          sql.raw(
            `SELECT COUNT(*)::int AS count FROM "${table}" WHERE user_id = '${USER_A}'::uuid`,
          ),
        );
        results[table] = Number(rows[0]?.count ?? 0);
      }
      return results;
    });

    expect(counts).toEqual({
      profile: 0,
      cards: 0,
      error_events: 0,
      weakness: 0,
      gamification: 0,
    });
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

import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import postgres from "postgres";

import { env } from "@/lib/config/env";

import { seedPostgresAppConfig } from "./seed.postgres";
import * as schema from "./schema.postgres";

export type PostgresDrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

let _client: PostgresDrizzleClient | null = null;
let _sql: ReturnType<typeof postgres> | null = null;
let _readyPromise: Promise<PostgresDrizzleClient> | null = null;

function isSupabaseHost(databaseUrl: string): boolean {
  try {
    const { hostname } = new URL(databaseUrl);
    return hostname.endsWith(".supabase.co") || hostname.endsWith(".pooler.supabase.com");
  } catch {
    return false;
  }
}

function usesSupabaseTransactionPooler(databaseUrl: string): boolean {
  try {
    const parsed = new URL(databaseUrl);
    const isSupabasePoolerHost =
      parsed.hostname.endsWith(".supabase.co") || parsed.hostname.endsWith(".pooler.supabase.com");
    return isSupabasePoolerHost && parsed.port === "6543";
  } catch {
    return false;
  }
}

function shouldRunCloudMigrations(): boolean {
  const raw = process.env.LANGTUTOR_RUN_MIGRATIONS?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;

  // Production serverless deployments should not run DDL on request paths.
  return process.env.NODE_ENV !== "production";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function connectAndMigrate(): Promise<PostgresDrizzleClient> {
  if (_client) return _client;

  if (env.LANGTUTOR_MODE !== "cloud") {
    throw new Error("getPostgresDrizzleClient() is only available when LANGTUTOR_MODE=cloud");
  }

  const databaseUrl = env.DATABASE_URL;
  _sql = postgres(databaseUrl, {
    max: 1,
    // Supabase transaction pooler (port 6543) does not support prepared statements.
    prepare: !usesSupabaseTransactionPooler(databaseUrl),
    // Supabase requires SSL on all cloud connections.
    ssl: isSupabaseHost(databaseUrl) ? "require" : false,
  });
  _client = drizzle(_sql, { schema });

  if (shouldRunCloudMigrations()) {
    try {
      await migrate(_client, {
        migrationsFolder: path.join(process.cwd(), "drizzle/postgres/migrations"),
      });
    } catch (error) {
      throw new Error(
        "[LangTutor] Cloud migration failed. " +
          "Run `pnpm db:migrate:postgres` against the target Supabase database using a role with DDL permissions. " +
          "If you intentionally want runtime migrations, set LANGTUTOR_RUN_MIGRATIONS=true. " +
          `Original error: ${toErrorMessage(error)}`,
      );
    }
  }

  try {
    await seedPostgresAppConfig(_client);
  } catch (error) {
    throw new Error(
      "[LangTutor] Cloud database is not initialized. " +
        "Apply migrations first with `pnpm db:migrate:postgres` against your production Supabase database. " +
        `Original error: ${toErrorMessage(error)}`,
    );
  }

  return _client;
}

/**
 * Returns the singleton Drizzle Postgres client. On first call: connects, runs pending
 * migrations, and seeds `appConfig` from env defaults if absent.
 */
export async function getPostgresDrizzleClient(): Promise<PostgresDrizzleClient> {
  if (_client) return _client;
  _readyPromise ??= connectAndMigrate();
  return _readyPromise;
}

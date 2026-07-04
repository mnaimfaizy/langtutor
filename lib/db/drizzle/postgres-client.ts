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

async function connectAndMigrate(): Promise<PostgresDrizzleClient> {
  if (_client) return _client;

  if (env.LANGTUTOR_MODE !== "cloud") {
    throw new Error("getPostgresDrizzleClient() is only available when LANGTUTOR_MODE=cloud");
  }

  const databaseUrl = env.DATABASE_URL;
  _sql = postgres(databaseUrl, { max: 1 });
  _client = drizzle(_sql, { schema });

  await migrate(_client, {
    migrationsFolder: path.join(process.cwd(), "drizzle/postgres/migrations"),
  });
  await seedPostgresAppConfig(_client);

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

import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";

import { env } from "@/lib/config/env";

import { seedAppConfig } from "./seed";
import * as schema from "./schema";

export type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

let _client: DrizzleClient | null = null;

/**
 * Returns the singleton Drizzle client. On first call: opens the SQLite file, runs
 * pending migrations, and seeds `appConfig` from env defaults if absent.
 */
export function getDrizzleClient(): DrizzleClient {
  if (_client) return _client;

  if (env.LANGTUTOR_MODE !== "local") {
    throw new Error("getDrizzleClient() is only available when LANGTUTOR_MODE=local");
  }

  const sqlite = new Database(env.LANGTUTOR_DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  _client = drizzle(sqlite, { schema });

  migrate(_client, {
    migrationsFolder: path.join(process.cwd(), "drizzle/migrations"),
  });

  seedAppConfig(_client);

  return _client;
}

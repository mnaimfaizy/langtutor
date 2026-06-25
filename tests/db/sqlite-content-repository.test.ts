import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";

import { SqliteContentRepository } from "@/lib/db/sqlite-content-repository";
import * as schema from "@/lib/db/drizzle/schema";
import type { ContentRepository } from "@/lib/db";

import { runContentRepositoryContract } from "./content-repository-contract";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle/migrations");

let sqlite: ReturnType<typeof Database>;

beforeEach(() => {
  sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
});

afterEach(() => {
  sqlite.close();
});

runContentRepositoryContract((): ContentRepository => {
  const db = drizzle(sqlite, { schema });
  return new SqliteContentRepository(db);
});

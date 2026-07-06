import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

// drizzle-kit runs in Node context and does not automatically load Next.js env files.
// Load .env.local first (developer overrides), then .env as a fallback.
loadEnv({ path: ".env.local" });
loadEnv();

// DATABASE_MIGRATION_URL: use a Session Pooler URL (port 5432, pooler host) for full DDL
// support on IPv4 networks.  Falls back to DATABASE_URL when not set.
// Get from: Supabase Dashboard → Connect → Session mode tab.
const databaseUrl =
  process.env.DATABASE_MIGRATION_URL?.trim().replace(/^['"]|['"]$/g, "") ??
  process.env.DATABASE_URL?.trim().replace(/^['"]|['"]$/g, "");

if (!databaseUrl) {
  throw new Error(
    "[drizzle.postgres.config] DATABASE_MIGRATION_URL or DATABASE_URL is required. " +
      "Set it in .env.local before running migrations. " +
      "Use the Session Pooler URL from Supabase Dashboard → Connect → Session mode.",
  );
}

function isSupabaseHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith(".supabase.co") || hostname.endsWith(".pooler.supabase.com");
  } catch {
    return false;
  }
}

export default defineConfig({
  schema: "./lib/db/drizzle/schema.postgres.ts",
  out: "./drizzle/postgres/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    // Supabase requires SSL on all connections.
    ssl: isSupabaseHost(databaseUrl) ? "require" : undefined,
  },
  // Prevent drizzle-kit from trying to manage Supabase's own built-in roles.
  entities: {
    roles: {
      provider: "supabase",
    },
  },
});

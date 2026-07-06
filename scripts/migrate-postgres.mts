/**
 * Preflight-checked Postgres migration runner.
 *
 * Loads .env.local / .env, validates the migration URL, tests TCP
 * connectivity, then delegates to drizzle-kit migrate.
 *
 * Usage: pnpm db:migrate:postgres
 */
import { execSync } from "node:child_process";
import { createConnection } from "node:net";
import { config as loadEnv } from "dotenv";

function strip(v: string | undefined): string | undefined {
  return v?.trim().replace(/^['"]|['"]$/g, "");
}

(async () => {
  loadEnv({ path: ".env.local" });
  loadEnv();

  const raw = strip(process.env.DATABASE_MIGRATION_URL) ?? strip(process.env.DATABASE_URL);

  if (!raw) {
    console.error(
      "\n❌  No migration URL found.\n" +
        "    Set DATABASE_MIGRATION_URL (or DATABASE_URL) in .env.local.\n",
    );
    process.exit(1);
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    console.error("\n❌  DATABASE_MIGRATION_URL is not a valid URL.\n");
    process.exit(1);
  }

  const host = parsed.hostname;
  const port = parseInt(parsed.port || "5432", 10);
  const masked = raw.replace(/:([^:@]+)@/, ":[hidden]@");

  const isDirectSupabase = /^db\.[a-z0-9]+\.supabase\.co$/.test(host);
  const isSessionPooler = /\.pooler\.supabase\.com$/.test(host) && port === 5432;
  const isTransactionPooler = /\.pooler\.supabase\.com$/.test(host) && port === 6543;

  console.log("\n📍 Migration target");
  console.log(`   URL  : ${masked}`);
  console.log(`   Host : ${host}:${port}`);

  if (isDirectSupabase) {
    console.log(`   Type : Supabase direct connection  ⚠️  IPv6-only on free tier`);
    console.log(
      "\n⚠️  Direct Supabase connections are IPv6-only on free-tier projects.\n" +
        "   On an IPv4 network (Windows, most home routers, Vercel) this will fail.\n\n" +
        "   Fix: replace DATABASE_MIGRATION_URL with the Session Pooler URL:\n\n" +
        "     postgresql://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:5432/postgres\n\n" +
        "   Get it from: Supabase Dashboard → Connect button → Session mode tab\n",
    );
  } else if (isSessionPooler) {
    console.log(`   Type : Supabase Session Pooler  ✅  IPv4-compatible, full DDL support`);
  } else if (isTransactionPooler) {
    console.log(`   Type : Supabase Transaction Pooler  ⚠️  use Session Pooler for migrations`);
    console.log(
      "\n⚠️  Transaction pooler (port 6543) is not recommended for migrations.\n" +
        "   Use Session Pooler (port 5432, pooler host) for DATABASE_MIGRATION_URL.\n",
    );
  } else {
    console.log(`   Type : Postgres (custom / self-hosted)`);
  }

  // TCP reachability check
  console.log(`\n🔍 Checking TCP connectivity to ${host}:${port}…`);

  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timed out after 5 s — ${host}:${port} is not reachable`));
    }, 5000);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      console.log(`✅  Reachable\n`);
      resolve();
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  }).catch((err: Error) => {
    console.error(`❌  ${err.message}`);
    if (isDirectSupabase) {
      console.error(
        "\n   Cannot reach Supabase direct connection (IPv4-only network).\n" +
          "   Set DATABASE_MIGRATION_URL to the Session Pooler URL from\n" +
          "   Supabase Dashboard → Connect → Session mode, then retry.\n",
      );
    }
    process.exit(1);
  });

  // Run drizzle-kit migrate
  console.log("🚀 Running drizzle-kit migrate…\n");
  try {
    execSync("pnpm drizzle-kit migrate --config drizzle.postgres.config.ts", {
      stdio: "inherit",
    });
  } catch {
    process.exit(1);
  }
})();

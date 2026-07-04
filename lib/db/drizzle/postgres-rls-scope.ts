import "server-only";

import { sql } from "drizzle-orm";

import type { PostgresDrizzleClient } from "./postgres-client";

/** Drizzle executor inside a `withUserRlsScope` transaction. */
export type PostgresDrizzleScope = Parameters<
  Parameters<PostgresDrizzleClient["transaction"]>[0]
>[0];

/** Postgres GUC read by RLS policies (ADR 0009). */
export const RLS_JWT_SUB_SETTING = "request.jwt.claim.sub";

/** Non-superuser role that respects RLS; postgres can SET LOCAL ROLE to it. */
export const RLS_APP_ROLE = "langtutor_app";

/**
 * Runs `fn` inside a transaction that assumes {@link RLS_APP_ROLE} and injects
 * `request.jwt.claim.sub` so per-user RLS policies can evaluate the session user.
 */
export async function withUserRlsScope<T>(
  db: PostgresDrizzleClient,
  userId: string,
  fn: (tx: PostgresDrizzleScope) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_APP_ROLE}`));
    await tx.execute(sql`SELECT set_config(${RLS_JWT_SUB_SETTING}, ${userId}, true)`);
    return fn(tx);
  });
}

# ADR 0003: Drizzle ORM with app-enforced user scoping

## Status: Accepted

## Context

Local persistence is SQLite; cloud is Supabase (Postgres). We want the cloud move to be
config-not-code. Supabase offers Row-Level Security (RLS), but making RLS the _primary_ mechanism
would diverge the cloud security model from local.

## Decision

- **Drizzle ORM**: define the schema **once**, emit both **SQLite** (local) and **Postgres**
  (cloud) dialects. The two `ContentRepository` concretes become thin dialect wrappers over shared
  query code. Local driver: **`better-sqlite3`** (fallback `node:sqlite` if native build bites).
- **App-enforced scoping**: every server query filters by the session `userId`, **symmetrically on
  both backends**. Scoping lives at a single choke point (the server repo adapter).
- **RLS later** as cloud **defense-in-depth**, not the primary mechanism.

Rejected: raw SQL per adapter (duplicate queries, cloud pays later); Prisma (heavy, codegen, two
schema files); Kysely (lighter but more manual than Drizzle here).

## Consequences

- One schema to maintain; Drizzle generates migrations.
- Cloud security depends on app-code discipline — mitigated by the single scoping choke point, a
  contract test asserting isolation (1b), and RLS as a later backstop.
- `embedding`/`payload` stored as JSON-text (SQLite) / jsonb (Postgres); vector indexing (pgvector)
  deferred.

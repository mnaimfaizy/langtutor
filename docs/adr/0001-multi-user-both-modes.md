# ADR 0001: Multi-user in both local and cloud modes

## Status: Accepted

## Context

v1 locked decision #1 was **single-user / local / no-auth**. The source is now intended to be
self-hostable as either a **personal local install** or a **public cloud deployment**, and in both
cases multiple people use it with **isolated data** (e.g. several learners sharing one laptop).
This reverses locked decision #1 and the single-user threat model behind the "accepted security
risks" in `docs/decisions.md`.

## Decision

- Both modes are **multi-user**.
- Two roles: **admin** (configures the whole app) and **standard** (uses available features).
- **First user is admin** — local: created at first-run; cloud: specified via env at init.
- **No self-registration** — admins create users.
- Local persistence = **SQLite**; cloud persistence + auth = **Supabase**.

## Consequences

- Every **per-user** table needs `userId` scoping; auth + sessions become required.
- The single-user "accepted security risks" (SSRF on `baseURL`/`sttUrl`, error leakage, in-process
  config) must be **fixed**, not accepted — tracked in Phase 1b / Phase 2.
- Large refactor, delivered in phases (see `tmp/auth-multiuser-plan.md`).

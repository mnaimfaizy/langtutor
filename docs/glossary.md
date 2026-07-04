# Glossary — Lang-Tutor

> One-line definitions of domain and architecture terms. Add a term when it's first introduced.

**Local mode** — self-hosted personal install; data in SQLite on the user's machine; self-hosted auth.

**Cloud mode** — public deployment; data + authentication via Supabase (Postgres); many users.

**Admin (role)** — user who can configure the whole app (global `appConfig`, user management). First user is admin.

**Standard (role)** — user who can use available learning features and owns only their own data.

**`AuthProvider` (seam)** — the auth interface (`getCurrentUser`, `signIn`, `signOut`, `createUser`, `listUsers`, `deleteUser`); local hand-rolled adapter vs cloud Supabase adapter.

**Transport A** — keep the `ContentRepository` interface unchanged and swap only the transport: client `HttpContentRepository` → Server Actions → server-side repo. Call sites don't change.

**Identity-aware transport** — every data action resolves a request-scoped current user before touching data (a stub admin in 1a; a real session in 1b).

**App-enforced scoping** — isolation by always filtering server queries by the session `userId` (vs relying on Supabase RLS as the primary mechanism).

**`appConfig`** — single global, admin-only config row (AI/infra endpoints + model names), seeded from env defaults and editable at runtime.

**Settings split** — separating today's `ProfileSettings` blob into global `appConfig` (admin-only) and per-user `profile` (cefr/goals/TTS).

**`LANGTUTOR_MODE`** — env flag (`local` | `cloud`) that selects which adapters the registry wires.

**`BOOTSTRAP_ADMIN_ID`** — constant user id all data maps to in Phase 1a, before real users exist.

**Per-user table** — table scoped by `userId` (profile, cards, errorEvents, weakness, gamification).

**Shared table** — global table with no `userId` (appConfig, lexiconCache, content) reused across users.

**Postgres RLS (Defense-in-depth)** — Using Row Level Security in Postgres (via SQL session variables) as a backstop alongside App-enforced scoping.

**Direct Drizzle Postgres Connection** — Connecting Drizzle directly to Postgres using `postgres.js` to maintain parity with SQLite, instead of querying via `@supabase/supabase-js`.

**Cloud AI Providers** — External API services (e.g., Groq, Mistral) used in Cloud Mode for LLM, STT, and Embeddings, securely configured entirely via `.env` variables rather than the database.

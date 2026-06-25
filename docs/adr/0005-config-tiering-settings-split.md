# ADR 0005: Config tiering and the settings split

## Status: Accepted

## Context

The source is self-hostable in local or cloud mode. Config must be clear for both audiences, and
multi-user means infrastructure config must **not** be editable by standard users. Today a single
`ProfileSettings` blob mixes shared infrastructure (Mac endpoints/models) with personal prefs
(TTS), and `Profile` holds per-learner state (cefr/goals).

## Decision

**Config tiering:**

- **Env (server-only, required, Zod-validated, fail-fast)** — holds `LANGTUTOR_MODE`, secrets,
  bootstrap (SQLite path / Supabase keys / initial admin email), and **defaults**. Parsed in
  `lib/config/env.ts` as a discriminated union on `MODE`.
- **`appConfig` (DB, admin-editable, seeded from env defaults)** — operational AI config
  (endpoints, model names). Changing a model name must not require a redeploy.

**Settings split (schema lands in 1a, enforcement in 1b):**

- **Global `appConfig`** (one row, admin-only): `macLlmBaseUrl`, `macLlmModel`, `macUtilityModel`,
  `macEmbedModel`, `macSttUrl` (generalizes to cloud-AI provider config).
- **Per-user `profile`**: `cefrLevel`, `goals`, TTS prefs, `createdAt`, `userId`.

**Docs:** separate `docs/deployment/local.md`, `docs/deployment/cloud.md`,
`docs/deployment/configuration.md` (env-var reference) + annotated `.env.example`.

## Consequences

- First concrete **authorization boundary**: global config = admin-only; profile/per-user = owner-only.
- Secrets never reach the client bundle or the DB; env is a Zod-parsed typed object (satisfies the
  "Zod-parse every external input" rule — env is external input).
- Self-hosters get a clear fail-fast error on misconfig instead of silent breakage.
- Preserves today's "env default → runtime override" pattern, promoted from per-profile to global.

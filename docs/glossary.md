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

**Groq LPU** — Groq's Language Processing Unit hardware; delivers LLM completions in 2–6 s for typical prompts, making Vercel Hobby's 10 s function timeout viable for most AI routes.

**Experience mode** — per-account presentation mode (`kid` | `adult`) chosen at onboarding; drives palette, navigation density, and content register, independent of CEFR level.

**Learning path** — the ordered sequence of units that forms the home experience; unlocks progressively and doubles as the main progress visualization.

**Unit** — one node on the learning path: a themed bundle of activities (vocab, listening, reading, …) planned by the LLM teacher around the static backbone.

**LLM teacher** — the server-side path planner persona: a professional English teacher (adult mode) or kindergarten teacher (kid mode) that plans and adapts units from profile, level, and weakness data.

**Path buffer** — the N upcoming units whose plan and content are pre-generated while the Mac/provider is reachable, so the path continues offline.

**Pre-A1 tier** — content tier below A1 for true beginners: alphabet, phonics, picture-word matching, listen-and-tap games; image- and audio-first.

**Media asset store** — shared storage of generated/curated images and TTS audio, keyed by word/phrase; generate once, reuse forever across users.

**Kid palette** — the bright/light theme family used in kid experience mode; shares the design system with the premium-dark adult brand.

**Quest** — a daily/weekly gamification goal ("review 10 words") with a reward on completion.

**Collectible** — a badge/sticker/creature earned by completing units or achievements; visually designed, browsable.

**`maxDuration`** — Vercel route-level export (`export const maxDuration = N`) that raises the function timeout above the plan default; used on content-generation routes that may exceed 10 s.

**Self-service registration** — Public sign-up flow where any visitor can create an account via Supabase Auth, without requiring an admin to create the account first (amends ADR 0001).

**Per-user rate limiting** — A guard that caps the number of AI API requests a single user can make per day, protecting shared free-tier API keys from exhaustion. Deferred post-launch feature (ADR 0012).

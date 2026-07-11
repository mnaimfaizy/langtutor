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

**LLM teacher** — the server-side path planner persona: a professional English teacher (adult mode) or kindergarten teacher (kid mode) that plans unit register, runs/interprets mastery checks, and produces motivational review guidance from profile, level, and weakness data — without reordering the grammar backbone (ADR 0032).

**Path buffer** — the N upcoming units whose plan and content are pre-generated while the Mac/provider is reachable, so the path continues offline.

**Grammar backbone** — the fixed, long-lived sequence of grammar constructions (university-grade map) that anchors unit order; not rearranged by the AI teacher.

**Mastery gate** — a check/exam at a **chapter/tier** boundary (`pre-A1`, `A1`…`C2`); in strict mode it must be passed before the next chapter’s first unit unlocks (ADR 0032–0035).

**Path chapter** — a contiguous group of path units at the same tier (`pre-A1` or one CEFR level); the visual journey milestone and the mastery-gate boundary.

**Progression mode** — **strict** (fail → teacher-assigned chapter review → must re-pass exam before next chapter) or **open** (exams/reports still run; gates do not block). Kids are always strict; adults default strict and may choose open (ADR 0033, ADR 0034, ADR 0042).

**Teacher report** — AI-generated, learner-facing feedback after a mastery gate: motivation plus concrete pointers to weaknesses.

**Review assignment** — structured, teacher-chosen set of units/skills within the failed chapter that the learner must complete before a strict-mode re-take (ADR 0036).

**Chapter exam** — hybrid mastery check at a chapter exit: fixed skill/shape checklist, AI-filled items, Zod-validated; pre-buffered for offline play when possible (ADR 0037). Pass requires overall score ≥ threshold **and** every skill section ≥ its floor (v1 defaults 70% / 50%); AI writes report/review assignment only (ADR 0038–0039).

**Exam buffer** — the next chapter exam (filled items) prepared while the AI provider is reachable, so a gate can still be taken offline.

**Curriculum constants** — slow-changing assets the teacher plans around: grammar constructions and a general vocabulary base (extra vocab retrieved gradually).

**Pre-A1 tier** — content tier below A1 for true beginners; planned to grow beyond the initial four single-activity units into a richer multi-unit, multi-activity chapter with a chapter exam (ADR 0016, ADR 0040).

**Curriculum guide** — a verified reference syllabus/course framework (by tier) that orients the AI teacher’s planning, exams, and reports; fundamental guidance, not a rigid script. In v1, guides are bundled/retrieved into prompts with model-knowledge adaptation — no live web search (ADR 0040, ADR 0041). First product slice may use a minimal pre-A1 guide stub (ADR 0043).

**First mastery-gate slice** — Pre-A1 chapter exam + teacher report + strict review/re-pass on the existing four units, before expanding pre-A1 content or gating A1+ (ADR 0043).

**Media asset store** — shared storage of generated/curated images and TTS audio, keyed by word/phrase; generate once, reuse forever across users.

**Media regenerate** — admin action that deletes (or overwrites) an existing media asset for a `(kind, key, style)` and produces a fresh generation for the same key.

**Proactive generate** — admin action that creates a media asset for a word/phrase that has no store row yet, without waiting for a learner resolve miss.

**Pending media gate** — generated (including admin-triggered) media assets are stored as `pending` and hidden from learners until an admin approves them.

**TTS length cap** — server-enforced maximum duration for stored media-asset audio (~5s, truncate); applies to learner resolve and admin generate/regenerate. See also **TTS duration cap**.

**Image prompt override** — optional admin-edited text used instead of the default kid-illustration template for a single image generate/regenerate; asset key stays the word + style.

**Stored generation prompt** — optional `prompt` field on a generated media-asset image row recording the exact text sent to the image provider; null for curated-pack rows.

**Admin audio media page** — dedicated admin route for reviewing and managing `kind: "audio"` media assets, separate from the image media page.

**Curriculum gap helper** — admin UI list of known pre-A1 vocabulary words missing a media-asset row for the current kind/style, used to drive proactive generate.

**Audio pending gate** — rule that newly generated TTS media assets start as `pending` and are hidden from learners until admin approval (parity with generated images).

**TTS duration cap** — ~5 second maximum for stored media-asset audio; longer clips are truncated before persist; admin may purge unacceptable clips entirely.

**Kid palette** — the bright/light theme family used in kid experience mode; shares the design system with the premium-dark adult brand.

**Quest** — a daily/weekly gamification goal ("review 10 words") with a reward on completion.

**Collectible** — a badge/sticker/creature earned by completing units or achievements; visually designed, browsable.

**`maxDuration`** — Vercel route-level export (`export const maxDuration = N`) that raises the function timeout above the plan default; used on content-generation routes that may exceed 10 s.

**Self-service registration** — Public sign-up flow where any visitor can create an account via Supabase Auth, without requiring an admin to create the account first (amends ADR 0001).

**Per-user rate limiting** — A guard that caps the number of AI API requests a single user can make per day, protecting shared free-tier API keys from exhaustion. Deferred post-launch feature (ADR 0012).

# AGENTS.md — Lang-Tutor

> Canonical guide for any coding agent (or human) working in this repo.
> **Source of truth for the roadmap is `PLAN.md`.** This file is the day-to-day operating manual;
> where the two overlap, PLAN.md §1 (locked decisions) wins. Keep this file current — it is
> updated at every phase close-out (PLAN.md §3.5). Stale agent docs are worse than none.

## Project frame

Lang-Tutor is a **single-user, local-first, gamified English-learning PWA** (content reaches
A1–C2). The UI is a Next.js app that runs locally on the user's laptop. Live AI (chat,
embeddings, and later Whisper STT) runs on the user's home Mac via Ollama (OpenAI-compatible API)
and is reached **only** from server route handlers over LAN/Tailscale. Everything is built behind
swappable **seams** so the app can later move to the cloud by changing config, not code. All
learner data and cached content live in IndexedDB (Dexie). No auth, no backend, no sync (yet).

## Current phase / next step

- **Phase 0 — Foundation & seams** (in progress).
- Done: **0.1** Scaffold · **0.2** AI agent guidance & skills · **0.3** UI layer over Base UI · **0.4** Dexie DB + `ContentRepository` seam · **0.5** `LLMClient` seam + `app/api/llm` proxy · **0.6** Config & Settings shell · **0.7** PWA shell (Serwist).
- **Next: 0.8** — Test harness: finalize Vitest config (+ fake-indexeddb, already here), add Playwright config + `test:e2e`, wire `test`/`test:e2e` into `verify`, sample unit + e2e. Then run the **Phase 0 close-out** (PLAN §3.5: `/code-review` + `/security-review` for the proxy/network/storage/SW).
- **PWA (0.7):** Serwist via **`@serwist/turbopack`** — the SW (`app/sw.ts`) is compiled by **esbuild inside `app/serwist/[path]/route.ts`**, served at `/serwist/sw.js`, registered by `SerwistProvider` in the layout. Turbopack build works with **no `--webpack`** (the §8 risk is resolved). `app/sw.ts` is excluded from `tsc` + ESLint (webworker globals). Manifest: `app/manifest.ts`; offline fallback: `app/~offline`; placeholder icons in `public/icons` (regen: `node scripts/generate-icons.mjs`).
- **Composition roots (split by environment):** `lib/registry.ts` is **client-safe** (`getContentRepository`); `lib/llm/server.ts` is **server-only** (`getLLMClient`). Client components may import the registry; only `app/api/llm/*` route handlers import `lib/llm/server`. (Dynamic `import()` does **not** keep `server-only` out of the client graph — splitting does.)
- **LLM access:** server-only `OllamaLLMClient` (Vercel AI SDK → Ollama) behind `getLLMClient()` (`lib/llm/server.ts`), reached **only** via `app/api/llm/{chat,embeddings,health}`. Mac endpoint/models from server env — copy `.env.example` → `.env.local`. `MockLLMClient` backs offline tests.
- **Runtime config (0.6):** Settings (`app/settings`) persist Mac endpoint/models to `profile.settings` (IndexedDB) **and** push them to a server-held override via `POST /api/llm/config`, so server-side calls route there. A boot component re-pushes on load. Connectivity indicator polls `/api/llm/health`. State-changing/Mac-calling POSTs are origin-guarded (`lib/server/origin.ts`). "Onboarded" ⇔ `profile.cefrLevel` is set (a profile may exist pre-onboarding just to hold settings).
- Base UI ships as **`@base-ui/react`** (renamed from the deprecated `@base-ui-components/react`); all usage is wrapped in `ui/`.
- **Vitest + `fake-indexeddb` were brought forward in 0.4** so the DB seam self-verifies (`pnpm test`). The _full_ harness (Playwright, `test:e2e`, CI `verify` wiring) still lands in **0.8**.
- Husky pre-commit gate is **deferred to Phase 0.8** (no full suite to gate on yet).

## Commands

| Command                             | What it does                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`                          | Dev server (Turbopack) at http://localhost:3000                                 |
| `pnpm build`                        | Production build (Turbopack)                                                    |
| `pnpm start`                        | Serve the production build                                                      |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (flat config)                                                            |
| `pnpm typecheck`                    | `tsc --noEmit`                                                                  |
| `pnpm format` / `pnpm format:check` | Prettier (+ Tailwind class sort)                                                |
| `pnpm test` / `pnpm test:watch`     | Vitest (unit; node env + `fake-indexeddb`) — added in 0.4                       |
| `pnpm verify`                       | typecheck + lint + format:check (CI-style gate; gains `test`/`test:e2e` in 0.8) |

`pnpm test:e2e` (Playwright) and the `verify` wiring of `test` arrive with the full harness in **Phase 0.8**.

## Architecture (detail in PLAN.md §2)

- **Topology:** Browser → (same-origin) Next.js app → server route handlers (`app/api/*`) → Mac.
  The browser never calls the Mac directly (mixed-content/CORS + keeps the endpoint server-side).
- **Seams (PLAN.md §2.3):** `LLMClient`, `LexiconProvider`, `ContentRepository`, `Transcriber`,
  `ContentValidator`. Feature code imports the **interface**; concretes are wired in
  `lib/registry.ts`. See the `seam-discipline` skill.
- **Pipeline:** generate → Zod-validate → ContentValidator (CEFR + grammar gate) → corrective
  retry → cache to IndexedDB → render.

## Hard rules

1. **No client → Mac calls.** Only `app/api/*` route handlers talk to the Mac.
2. **Import seam interfaces, never concretes.** Wire concretes in `lib/registry.ts`.
3. **Zod-parse every LLM / agent / external output** before use.
4. **TypeScript strict; no `any`** in committed code.
5. **Server Components by default;** `"use client"` only where interactivity requires it.
6. **No feature code imports Base UI directly** — go through `ui/` wrappers.
7. **Use Tailwind theme tokens** (`bg-background`, `text-foreground`, …); support light + dark.
8. **Secrets/endpoints server-only** (`.env.local` / `profile.settings`), never in client bundles.
9. **Commit only when the user asks.**

## Repo layout (target — PLAN.md §3.1)

```
app/        Next.js App Router. app/api/* = the ONLY callers of the Mac.
lib/        Seams + pure logic (llm, lexicon, content, srs, diagnostics,
            gamification, db, agent) + registry.ts (composition root).
ui/         Our component layer wrapping Base UI.
data/       Bundled datasets (WordNet, Words-CEFR, grammar map, seed).
workers/    Web workers (WER, audio normalize).
tests/      Vitest unit + Playwright e2e.
.claude/    skills/ (implement-plan-step, seam-discipline, stack-conventions) + settings.json.
```

(`app/` + `app/api/llm` + `app/settings` + PWA files (`app/sw.ts`, `app/serwist`, `app/~offline`, `app/manifest.ts`), `ui/`, `lib/db` + `lib/llm` + `lib/server` + `lib/registry.ts`, `public/icons`, `scripts/`, and `tests/` exist today; the rest land as their phases arrive.)

## Definition of Done (every step — PLAN.md §3.3)

Code compiles & lints clean · the step's **Accept** criteria pass · its **Verify** passes (named
test green or manual checklist ticked) · no regression in existing suites · the **per-phase
close-out (§3.5)** is honored at phase boundaries.

## How to work a step

Use the **`implement-plan-step`** skill: read the step's Build/Accept/Verify/Dep → tests-first for
pure logic → implement behind the seam → `pnpm verify` + the step's test → report with evidence.
At a phase boundary, run the §3.5 close-out (incl. `/code-review`, and `/security-review` for
proxy/network/storage/audio changes) and update this file's **Current phase / next step**.

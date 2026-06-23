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

- **Phase 0 — Foundation & seams — ✅ complete** (all 8 steps + the §3.5 close-out).
- **Phase 1 — Data backbone & content infrastructure — ✅ complete** (all 8 steps + `/code-review`).
- Done (Phase 1): **1.1** WordNet bundle + lexicon queries · **1.2** Words-CEFR mapping + `cefrLevel` · **1.3** `LexiconProvider` seam + `LocalLexiconProvider` · **1.4** CEFR grammar progression map · **1.5** `ContentValidator` (word + grammar gate) · **1.6** Cosine-similarity search helper · **1.7** Generate-and-cache pipeline.
- **Next: Phase 2.1** — Placement quiz (adaptive vocab yes/no) + onboarding shell.
- **Phase 1 close-out notes:**
  - `lib/lexicon/server.ts` — server-only `getLexiconProvider()` (mirrors `lib/llm/server.ts`). Audio caching is intentionally **omitted** on the server (`repo: null`) because IndexedDB (Dexie) is browser-only. Client-side audio caching is wired in Phase 3.2.
  - `lib/lexicon/data-loader.ts` — synchronous `readFileSync` with a friendly ENOENT message directing devs to run `node scripts/build-wordnet.mjs` / `node scripts/build-words-cefr.mjs`.
  - `data/grammar-map.json` is validated at module-load time via Zod (`z.enum(["A1"…"C2"])`) so authoring typos surface at startup, not silently at runtime.
  - `LocalContentValidator` pre-compiles regex markers once in the constructor (no per-call `new RegExp`).
  - Pipeline corrective-retry sends `JSON.stringify(parsed)` as the assistant turn (not just the text field) so multi-field schemas retain full context across retries.
  - **Generated data files** (`data/wordnet.json`, `data/words-cefr.json`) are **gitignored**. Fresh-checkout setup: `pnpm install && node scripts/build-wordnet.mjs && node scripts/build-words-cefr.mjs` (needs internet for the CEFR script).
- **Status tokens** (added in the 0.8 close-out): use `bg-success`/`text-success`, `bg-warning`, `bg-danger`/`text-danger` for state colors — never raw palette utilities (hard rule #7). Defined in `app/globals.css` (light + dark).
- **Proxy hardening** (0.8 close-out): `app/api/llm/*` redact upstream errors and cap request sizes. Residual SSRF/CSRF accepted under single-user/local/no-auth model; revisit on any multi-user/cloud move.
- **PWA (0.7):** Serwist via **`@serwist/turbopack`** — the SW (`app/sw.ts`) is compiled by **esbuild inside `app/serwist/[path]/route.ts`**, served at `/serwist/sw.js`, registered by `SerwistProvider`. Manifest: `app/manifest.ts`; offline fallback: `app/~offline`; regen icons: `node scripts/generate-icons.mjs`.
- **Composition roots (split by environment):** `lib/registry.ts` is **client-safe** (`getContentRepository`); `lib/llm/server.ts` is **server-only** (`getLLMClient`); `lib/lexicon/server.ts` is **server-only** (`getLexiconProvider`). Dynamic `import()` does **not** keep `server-only` out of the client graph — splitting does.
- **LLM access:** server-only `OllamaLLMClient` (Vercel AI SDK → Ollama) behind `getLLMClient()` (`lib/llm/server.ts`), reached **only** via `app/api/llm/{chat,embeddings,health}`. Mac endpoint/models from server env — copy `.env.example` → `.env.local`. `MockLLMClient` backs offline tests.
- **Runtime config (0.6):** Settings persist Mac endpoint/models to `profile.settings` (IndexedDB) **and** push to a server-held override via `POST /api/llm/config`. Connectivity indicator polls `/api/llm/health`. State-changing POSTs are origin-guarded (`lib/server/origin.ts`). "Onboarded" ⇔ `profile.cefrLevel` is set.
- Base UI ships as **`@base-ui/react`**; all usage is wrapped in `ui/`.
- **Test harness (0.8):** Vitest (node + `fake-indexeddb`) in `tests/**/*.test.ts`; Playwright e2e in `tests/e2e/**/*.spec.ts`. `pnpm verify` = typecheck + lint + format + unit tests. `pnpm test:e2e` is separate. Fresh machines need `pnpm exec playwright install chromium`.

## Commands

| Command                             | What it does                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`                          | Dev server (Turbopack) at http://localhost:3000                                   |
| `pnpm build`                        | Production build (Turbopack)                                                      |
| `pnpm start`                        | Serve the production build                                                        |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (flat config)                                                              |
| `pnpm typecheck`                    | `tsc --noEmit`                                                                    |
| `pnpm format` / `pnpm format:check` | Prettier (+ Tailwind class sort)                                                  |
| `pnpm test` / `pnpm test:watch`     | Vitest (unit; node env + `fake-indexeddb`)                                        |
| `pnpm test:e2e`                     | Playwright e2e (chromium; auto-starts the dev server)                             |
| `pnpm verify`                       | typecheck + lint + format:check + **unit** tests (CI-style gate; e2e is separate) |
| `node scripts/build-wordnet.mjs`    | Generate `data/wordnet.json` (~40 MB; needs `wordpos` devDep installed)           |
| `node scripts/build-words-cefr.mjs` | Generate `data/words-cefr.json` (~3 MB; needs internet)                           |

## Architecture (detail in PLAN.md §2)

- **Topology:** Browser → (same-origin) Next.js app → server route handlers (`app/api/*`) → Mac.
  The browser never calls the Mac directly (mixed-content/CORS + keeps the endpoint server-side).
- **Seams (PLAN.md §2.3):** `LLMClient`, `LexiconProvider`, `ContentRepository`, `Transcriber`,
  `ContentValidator`. Feature code imports the **interface**; concretes are wired in
  `lib/registry.ts` (client-safe) or the seam's own `server.ts` (server-only). See the
  `seam-discipline` skill.
- **Pipeline:** `lib/content/pipeline.ts` `generateContent<T>(opts, llmClient, validator, repo)`
  implements PLAN §2.4: chat(schema) → ContentValidator.validate → corrective retry (with
  `JSON.stringify(parsed)` in the assistant turn) → `ContentRepository.putContent` → return.
- **`lib/content/` module:** `grammar-map.ts` (39-entry A1–C2 map, Zod-validated at load) ·
  `content-validator.ts` (`LocalContentValidator` with pre-compiled markers) ·
  `embeddings.ts` (`cosineSimilarity`, `findNearest`) · `pipeline.ts`.
- **`lib/lexicon/` module:** `wordnet-query.ts` / `cefr-lookup.ts` (pure fns, data injected) ·
  `lexicon-provider.ts` (interface) · `local-lexicon-provider.ts` (impl; `repo: null` on server)
  · `data-loader.ts` (server-only fs loader) · `server.ts` (server-only singleton).

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

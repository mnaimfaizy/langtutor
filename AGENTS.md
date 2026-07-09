# AGENTS.md — Lang-Tutor

> Canonical guide for any coding agent (or human) working in this repo.
> **Source of truth for architecture and decisions is `docs/`.** This file is the day-to-day
> operating manual. Stale agent docs are worse than none.

## Project frame

Lang-Tutor is a **single-user, local-first, gamified English-learning PWA** (content reaches
A1–C2). The UI is a Next.js app that runs locally on the user's laptop. Live AI (chat,
embeddings, and Whisper STT) runs on the user's home Mac via Ollama (OpenAI-compatible API)
and is reached **only** from server route handlers over LAN/Tailscale. Everything is built behind
swappable **seams** so the app can later move to the cloud by changing config, not code. All
learner data and cached content live in IndexedDB (Dexie). No auth, no backend, no sync (yet).

## Current state

All v1 phases (0–8) are complete. The app ships:

- Vocabulary SRS (FSRS) + adaptive placement quiz
- Reading, Writing, Listening, and Speaking modules
- Weakness engine + diagnostics heatmap + adaptive topic selection
- Gamification (XP, streak, level, achievements)
- Offline-first PWA (Serwist) with JSON backup/restore

**Next work** is tracked in [GitHub issues](https://github.com/mnaimfaizy/langtutor/issues).
Use `/to-issues` to break down a new feature. See `docs/roadmap-history.md` for the full
phase history and `docs/decisions.md` for open roadmap items.

## Commands

| Command                                    | What it does                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `pnpm dev`                                 | Dev server (Turbopack) at http://localhost:3000                                   |
| `pnpm build`                               | Production build (Turbopack)                                                      |
| `pnpm start`                               | Serve the production build                                                        |
| `pnpm lint` / `pnpm lint:fix`              | ESLint (flat config)                                                              |
| `pnpm typecheck`                           | `tsc --noEmit`                                                                    |
| `pnpm format` / `pnpm format:check`        | Prettier (+ Tailwind class sort)                                                  |
| `pnpm test` / `pnpm test:watch`            | Vitest (unit; node env + `fake-indexeddb`)                                        |
| `pnpm test:e2e`                            | Playwright e2e (chromium; auto-starts the dev server). Specs import from `tests/e2e/fixtures.ts`, which stubs Mac-facing APIs via `stubMacApis` so e2e never hits a live Ollama/Whisper endpoint. |
| `pnpm verify`                              | typecheck + lint + format:check + **unit** tests (CI-style gate; e2e is separate) |
| `node scripts/build-wordnet.mjs`           | Generate `data/wordnet.json` (~40 MB; needs `wordpos` devDep installed)           |
| `node scripts/build-words-cefr.mjs`        | Generate `data/words-cefr.json` (~3 MB; needs internet)                           |
| `node scripts/build-illustration-pack.mjs` | Generate `data/illustration-pack/` (pre-A1 CC0/CC-BY illustrations)               |

## Optional tooling

- **Graphify** (`graphify .`, `/graphify query|path|explain`) — optional, **per-developer, globally
  installed** code-graph aid for navigation/comprehension. **Not part of the repo toolchain**: no
  Python in `package.json`/CI, no git hooks (do **not** run `graphify hook install`). Output dir
  `graphify-out/` is gitignored and regenerated **on-demand**. It is a **pull-only navigation lead,
  not a seam and not a source of truth** — never wire `graph.json` into `app/`/`lib/`, and always
  confirm any graph claim against the actual source (trust AST-`EXTRACTED` edges over LLM-`INFERRED`
  ones). Run code-only / no cloud API key to keep it $0 and private.

## Architecture

Full detail in `docs/architecture.md`. Key points:

- **Topology:** Browser → (same-origin) Next.js app → server route handlers (`app/api/*`) → Mac.
  The browser never calls the Mac directly (mixed-content/CORS + keeps the endpoint server-side).
- **Seams:** `LLMClient`, `LexiconProvider`, `ContentRepository`, `Transcriber`, `ContentValidator`.
  Feature code imports the **interface**; concretes are wired in `lib/registry.ts` (client-safe)
  or the seam's own `server.ts` (server-only). See the `seam-discipline` skill.
- **Pipeline:** `lib/content/pipeline.ts` — `generateContent<T>()` implements chat → validate →
  corrective retry → `ContentRepository.putContent` → return.
- **Composition roots:** `lib/registry.ts` (client-safe), `lib/llm/server.ts` (server-only),
  `lib/lexicon/server.ts` (server-only). Dynamic `import()` does **not** keep `server-only` out
  of the client graph — environment splitting does.
- **`lib/content/`:** `grammar-map.ts` (39-entry A1–C2 map) · `content-validator.ts` ·
  `embeddings.ts` · `pipeline.ts`.
- **`lib/lexicon/`:** `wordnet-query.ts` / `cefr-lookup.ts` (pure fns, data injected) ·
  `lexicon-provider.ts` (interface) · `local-lexicon-provider.ts` (impl) ·
  `data-loader.ts` (server-only) · `server.ts` (server-only singleton).

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

## Skills (`.claude/skills/`)

Not sure which skill to use? Start with **`/ask-matt`**.

**Planning & design:**

- **`ask-matt`** — Router: which skill or flow fits your situation.
- **`grill-with-docs`** — Relentless interview to sharpen a plan + produce ADRs/glossary.
- **`domain-modeling`** — Build/sharpen `CONTEXT.md` and ADRs as designs crystallise.
- **`prototype`** — Throwaway code to answer a design question (logic TUI or UI variants).
- **`codebase-design`** — Shared vocabulary for deep modules (seam, adapter, leverage, locality).
- **`improve-codebase-architecture`** — Scan for deepening opportunities; HTML report + grilling.

**Delivery:**

- **`to-prd`** — Turn a discussion into a PRD published to GitHub issues.
- **`to-issues`** — Break a PRD into independently-grabbable vertical-slice GitHub issues.
- **`implement`** — Implement a GitHub issue test-first.
- **`tdd`** — Test-driven development (red-green-refactor, vertical slices).

**Maintenance:**

- **`triage`** — Move GitHub issues through triage roles; write agent-ready briefs.
- **`diagnosing-bugs`** — Structured 6-phase debug loop for hard bugs and regressions.
- **`resolving-merge-conflicts`** — Structured approach to git merge/rebase conflicts.
- **`handoff`** — Compact the current conversation into a handoff document for the next session/agent.

**Project-specific:**

- **`seam-discipline`** — Enforce interface-only imports, composition root wiring, Zod-parse rule.
- **`stack-conventions`** — Next.js/React/Tailwind/Base UI/Zod/FSRS conventions.

> **Skill hygiene:** If `seam-discipline` or `stack-conventions` is incomplete or misleading for
> your current feature, **do not silently update it.** Flag the gap to the human — state the rule
> that needs changing, why, and the proposed new wording. The human approves all skill edits.

## Repo layout

```
app/        Next.js App Router. app/api/* = the ONLY callers of the Mac.
lib/        Seams + pure logic (llm, lexicon, content, srs, diagnostics,
            gamification, db, agent, transcriber, audio, tts, placement,
            deck, backup) + registry.ts (composition root).
ui/         Our component layer wrapping Base UI.
data/       Bundled datasets (WordNet, Words-CEFR, grammar map, seed).
workers/    Web workers (WER, audio normalize).
tests/      Vitest unit + Playwright e2e.
docs/       Architecture, conventions, roadmap history, decisions.
.claude/    skills/ + settings.json.
```

## Definition of Done (every feature)

Code compiles & lints clean · acceptance criteria pass · `pnpm verify` green · no regression in
existing Vitest/Playwright suites · at close-out: run **`/code-review`** (+ **`/security-review`**
if the change touched the proxy, networking, storage, or audio capture).

## How to work a feature

1. Use **`/grill-with-docs`** to sharpen the plan and produce ADRs.
2. Use **`/to-prd`** to turn the discussion into a PRD on GitHub issues.
3. Use **`/to-issues`** to break the PRD into vertical-slice GitHub issues.
4. Use **`/tdd`** to implement each issue test-first — consult `seam-discipline` and
   `stack-conventions` for project-specific constraints.
5. At close-out: run **`/code-review`**, and **`/security-review`** for proxy/network/storage/audio changes.

# Lang-Tutor — Build Plan

> A single-user, local-first, gamified English-learning PWA. Content reaches A1–C2.
> Live AI runs on a home Mac (local models, OpenAI-compatible API) and is reached from a
> laptop-hosted Next.js app over LAN/Tailscale. Everything is built behind swappable seams so
> the app can later move to the cloud by changing config, not code.
>
> This document is the **source of truth** for an AI agent (or human) picking up the build.
> It supersedes `English Learning Web App Guide.md`, which is a technology survey, not a plan.
> Where the two conflict, **this file wins** (see §1 and §10 for what was deliberately dropped).

---

## 1. Locked decisions (source of truth)

| # | Decision | Locked choice | Why it matters downstream |
|---|----------|---------------|---------------------------|
| 1 | **Scope** | Single-user, local-first. IndexedDB only. **No** auth / Supabase / sync / RLS / WebSockets. One primary device + JSON export/import backup. | Deletes the entire "Backend Strategy" section of the guide. |
| 2 | **Learner** | Generic **A1–C2**. Onboarding = adaptive **vocab yes/no** placement (+ pseudowords) → CEFR estimate; level self-refines with use. UI in English only. | Placement needs no LLM; runs offline from bundled data. |
| 3 | **Offline model** | **Bundled open-data backbone** always offline. Dynamic content (passages, quizzes, feedback) is **generate-and-cache**. Ship a **tiny starter seed** (a few passages + a starter vocab deck per level). | "Offline-first" = backbone + already-generated content; *new* generation needs the Mac reachable. No big pre-gen pipeline. |
| 4 | **AI infra** | Local models on the Mac via **Ollama** (OpenAI-compatible API), behind **one `LLMClient` seam** (`baseURL`/`model`/`apiKey`). **No** in-browser WebLLM/WebGPU. | "Switch to cloud later" = edit config. |
| 5 | **Model roster** | Primary **~14B** (Qwen2.5-14B-Instruct class) · utility **~7B** · **embedding** model (nomic-embed-text / bge-m3) · **Whisper** (whisper.cpp / faster-whisper) added at the speech phase. All swappable. | 48 GB M4 Pro runs primary + utility + embedding concurrently with headroom. |
| 6 | **Topology** | Next.js app runs **locally on the laptop** (`localhost`, **no Vercel**). Models on the Mac. Linked via **LAN at home / Tailscale away**. Browser → Next server (same origin) → **server-side proxy** → Mac. | Avoids CORS + HTTPS→HTTP mixed-content. Keeps the LLM endpoint server-side. |
| 7 | **MVP scope** | **Full four skills** (reading, writing, listening, speaking) + vocab SRS + continuous diagnostics/heatmap + light gamification — built in **shippable phases**. | Usable app at the end of Phase 2; each later phase adds one capability. |
| 8 | **Data sources** | Free/open, **bundled offline**: **WordNet** (definitions, synonyms, hypernyms/hyponyms) · **Free Dictionary API / Wiktionary** (audio) · **Words-CEFR-Dataset** (word levels) · our **own CEFR grammar map**. All behind a `LexiconProvider` seam. Oxford/WordsAPI/Cambridge **dropped** (paid/restricted/non-redistributable). | License-clean, $0, offline-native. |
| 9 | **Enrichment agent** | **Runtime on-demand only**: gap + online → research (local model + web) → **validate** → display → **cache** to IndexedDB. Writes **structured data**, never raw HTML. | First encounter of a missing item is online; offline forever after. |
| 10 | **SRS** | **FSRS** via `ts-fsrs` (ratings: Again/Hard/Good/Easy). **Not** SM2/DolphinSR. | Fewer reviews for the same retention; self-tuning. |
| 11 | **UI layer** | **Base UI** primitives + **Tailwind v4**, wrapped behind our **own `ui/` component layer** so the primitive lib is swappable. Hand-build anything Base UI lacks. | Neutralizes Base UI's youth/bleeding-edge risk. |
| 12 | **Testing** | **Targeted**: Vitest for pure logic (FSRS, CEFR gate, WER, Zod schemas, LLMClient seam) + Playwright smoke tests (onboarding, do-lesson, review-card) + a manual checklist per step. | Agents self-verify the risky logic; humans eyeball UI feel. |
| 13 | **Diagnostics** | **Continuous**: every activity emits CEFR/category-tagged error events → weakness model → biases next content + feeds heatmap. Woven into each skill module. Exam/level-check mode is a later add. | Not a separate late module. |
| 14 | **Gamification** | **Light**: XP + daily streak + XP-based level + ~5 milestone achievements. All local/instant. **No** serverless/WebSockets, no leaderboards/social. | Deletes the guide's async XP/streak machinery. |

**Core stack:** Next.js 16 · React 19 · Turbopack · Serwist (`@serwist/next`) · Tailwind v4 · Base UI · Dexie (IndexedDB) · Zustand · Zod · Vercel AI SDK (OpenAI-compatible provider) · Framer Motion · `ts-fsrs` · Vitest · Playwright · TypeScript (strict).

---

## 2. System architecture

### 2.1 Topology

```
   ┌─────────────────────────── Your laptop ───────────────────────────┐
   │  Browser (PWA, installed)                                          │
   │     │  same-origin fetches only                                    │
   │     ▼                                                              │
   │  Next.js app (next start on localhost / Tailscale hostname)        │
   │     • UI (React 19, Base UI, Tailwind)                             │
   │     • IndexedDB via Dexie  (all learner data + content cache)      │
   │     • Server route handlers = the ONLY thing that talks to the Mac │
   └───────────────────────────────┬────────────────────────────────────┘
                                    │  LAN at home / Tailscale away (HTTPS)
                                    ▼
   ┌─────────────────────────── Home Mac (M4 Pro, 48 GB) ───────────────┐
   │  Ollama  (OpenAI-compatible /v1/chat/completions, /v1/embeddings)  │
   │     • primary ~14B   • utility ~7B   • embedding model             │
   │  whisper-server (whisper.cpp / faster-whisper)  [speech phases]    │
   └────────────────────────────────────────────────────────────────────┘
```

**Why the server-side proxy is mandatory:** a browser on an HTTPS page cannot call a plain-HTTP
LAN address (mixed content is blocked). The browser only ever calls the Next.js app (same origin);
the Next **server** calls the Mac. This also keeps the Mac endpoint/key out of client code.

### 2.2 Online vs offline behavior

| Capability | Works offline? | Needs Mac reachable? |
|------------|----------------|----------------------|
| Dictionary lookup, word CEFR, synonyms/relations | ✅ (bundled) | No |
| Vocab SRS review (existing cards) | ✅ | No |
| Re-read already-generated/cached passages, retake cached quizzes | ✅ | No |
| Placement quiz | ✅ (bundled dataset) | No |
| Starter-seed passages/deck (day one) | ✅ (bundled) | No |
| Gamification (XP/streak/level/achievements) | ✅ | No |
| **Generate** new passage/quiz/lesson | ❌ | Yes |
| Writing feedback, conversation, enrichment agent | ❌ | Yes |
| Listening TTS (browser) | ✅ | No |
| Listening transcription scoring (WER) | ✅ (logic local) | No |
| Speaking transcription (Whisper) | ❌ | Yes (Mac whisper-server) |

**Rule:** anything the Mac produces is **validated then cached to IndexedDB**, so it becomes offline-available after first use.

### 2.3 The seams (build these once; everything else depends on them)

| Seam | Interface (conceptual) | Local impl now | Swap target later |
|------|------------------------|----------------|-------------------|
| `LLMClient` | `chat(messages, {schema?, stream?})`, `embed(texts)` | Vercel AI SDK → Ollama (OpenAI-compatible), via server proxy | Cloud LLM (change `baseURL`/`model`/`apiKey`) |
| `LexiconProvider` | `define(word)`, `relations(word)`, `cefrLevel(word)`, `audio(word)` | Bundled WordNet + Words-CEFR-Dataset + Free Dictionary API (cached) | Oxford/WordsAPI behind same interface |
| `ContentRepository` | CRUD for profiles, cards, content, error-events, gamification | Dexie/IndexedDB | Add a `SyncedRepository` (cloud) later |
| `Transcriber` | `transcribe(audio) → text` | Mac whisper-server (speech phases) | Azure / cloud STT behind same interface |
| `ContentValidator` | `validate(text, targetCefr) → {ok, violations}` | Local: parse words → CEFR check + grammar-map check | — |

> **Non-negotiable:** feature code imports the **interface**, never a concrete provider. Concretes are wired in one composition root (`lib/registry.ts`). This is what makes "cloud later" a config change.

### 2.4 Generate → validate → cache pipeline

```
request content (topic, level, type)
   → LLMClient.chat(prompt, {schema})        # Zod-validated structured output
   → ContentValidator.validate(text, level)  # CEFR words + grammar map gate
        ├─ violations → corrective re-prompt (max N retries)
        └─ ok → ContentRepository.cacheContent(...)  # offline thereafter
   → render
```

---

## 3. Repo conventions

### 3.1 Proposed structure

```
lang-tutor/
├─ app/                       # Next.js App Router
│  ├─ (learn)/                # main app routes (reading, writing, listening, speaking, review)
│  ├─ onboarding/             # placement quiz + profile
│  ├─ dashboard/              # progress + weakness heatmap
│  ├─ settings/               # Mac endpoint, model, TTS prefs, export/import
│  └─ api/                    # server route handlers (the ONLY callers of the Mac)
│     ├─ llm/                 # proxy → Ollama chat/embeddings
│     └─ stt/                 # proxy → whisper-server (speech phases)
├─ lib/
│  ├─ llm/                    # LLMClient seam + prompts + Zod schemas
│  ├─ lexicon/                # LexiconProvider seam + WordNet/CEFR/dictionary impls
│  ├─ content/                # generate-validate-cache pipeline, ContentValidator
│  ├─ srs/                    # ts-fsrs wrapper, review queue
│  ├─ diagnostics/            # error-event model, weakness model
│  ├─ gamification/           # XP/streak/level/achievements (pure functions)
│  ├─ db/                     # Dexie schema + ContentRepository
│  ├─ agent/                  # runtime enrichment agent (web research + validate + cache)
│  └─ registry.ts             # composition root: wires concretes to seams
├─ ui/                        # our component layer wrapping Base UI (Button, Dialog, Tooltip…)
├─ data/                      # bundled datasets (WordNet subset, Words-CEFR, grammar map, seed)
├─ workers/                   # web workers (heavy local work, e.g. WER, audio normalize)
├─ tests/                     # Vitest unit + Playwright e2e
├─ .claude/                   # Claude Code config + project skills
│  ├─ skills/                 # authored: implement-plan-step, seam-discipline, stack-conventions
│  └─ settings.json           # pnpm permissions
├─ .husky/                    # (optional, deferrable) pre-commit gate: tsc + eslint + vitest
├─ AGENTS.md                  # canonical agent guide (commands, conventions, current phase) — living doc
├─ CLAUDE.md                  # thin: imports @AGENTS.md + Claude-Code-specific notes
└─ PLAN.md
```

### 3.2 Conventions
- **TypeScript strict**; no `any` in committed code. All LLM/agent outputs parsed through **Zod** before use.
- **Server components by default**; client components only where interactivity requires.
- All Mac access goes through `app/api/*` → seam. **No client-side calls to the Mac.**
- Pure logic (FSRS, validator, WER, gamification, weakness model) lives in `lib/` as **side-effect-free functions** → unit-testable without a browser.
- Env: `MAC_LLM_BASE_URL`, `MAC_LLM_MODEL`, `MAC_UTILITY_MODEL`, `MAC_EMBED_MODEL`, `MAC_STT_URL` in `.env.local` (server-only). A Settings UI can override at runtime (stored in IndexedDB).

### 3.3 Definition of done (every step)
A step is **done** only when: code compiles & lints clean · its stated **acceptance criteria** pass · its **verify** method passes (named test green, or manual checklist ticked) · no regression in existing Vitest/Playwright suites · the **per-phase close-out (§3.5)** is honored at phase boundaries.

### 3.4 AI agent guidance — living docs & skills
- **`AGENTS.md`** (repo root) is the **canonical** guide for any coding agent: a one-paragraph project frame, the seams (§2.3) and hard rules (§3.2), the commands (`pnpm dev/build/test/test:e2e/verify`), the per-step Definition of Done, and a **"Current phase / next step"** pointer kept current. Nested `AGENTS.md` files may be added in subtrees (e.g. `lib/llm/`) when local rules need emphasis.
- **`CLAUDE.md`** (repo root) is **thin**: it imports the canonical guide via `@AGENTS.md` and adds only Claude-Code-specific notes (which skills to invoke, how to run `verify`, the memory pointer). Single source of truth = `AGENTS.md`; `CLAUDE.md` never duplicates it.
- **Project skills** (`.claude/skills/<name>/SKILL.md`) codify best practices as enforceable, invokable modules instead of prose nobody re-reads. Baseline set authored in **Phase 0.2**. Built-in **`/code-review`** and **`/security-review`** are used at close-out.
- **Quality gate** (optional, deferrable): a **Husky** pre-commit hook (+ `lint-staged`) runs typecheck + lint + targeted tests so regressions can't pass silently — tool-agnostic, fires for any committer. `.claude/settings.json` is used only for `pnpm` permissions.
- These are **living docs** — kept current via §3.5. Stale agent docs are worse than none.

### 3.5 Per-phase close-out (end of every phase — part of Definition of Done)
1. **All phase steps pass** their Accept + Verify; full Vitest + Playwright suites green.
2. **`/code-review`** the phase diff (+ **`/security-review`** if it touched the proxy, network, storage, or audio capture).
3. **Update `AGENTS.md`** — new commands, conventions, seams, data-model changes, and the "Current phase / next step" pointer.
4. **Update `CLAUDE.md`** only if Claude-specific guidance changed (usually just the phase pointer, inherited via the `@AGENTS.md` import).
5. **Add/Update skills** in `.claude/skills/` if the phase established a new recurring pattern worth enforcing (e.g. a content-generation prompt convention, a diagnostics-event tagging rule).
6. **Update `PLAN.md`** if reality diverged — note deviations; keep §1 decisions honest.

---

## 4. Cross-cutting data model (Dexie tables — overview)

Defined fully in Phase 0/1; listed here so steps can reference them.

- `profile` — single row: cefrLevel, goals, createdAt, settings.
- `cards` — vocab SRS cards: word, sense, definition, examples, cefr, FSRS state (due, stability, difficulty, reps, lapses).
- `content` — cached generated/seed content: type (passage|quiz|prompt|lesson), level, topic, payload (JSON), source (seed|generated|agent), validatedAt, embedding(optional).
- `errorEvents` — diagnostics: skill, category, cefr, context (sentence), createdAt.
- `weakness` — derived/rolled-up: skill × category × cefr → score/confidence (recomputed from errorEvents).
- `gamification` — xp, level, streakCount, lastActivityDate, achievements[].
- `lexiconCache` — cached dictionary/audio lookups (from Free Dictionary API / agent).

---

## 5. Dev workflow & one-time setup

**Mac (server):**
1. Install Ollama; pull primary ~14B, utility ~7B, embedding model. `ollama serve`.
2. (Speech phases) install whisper.cpp/faster-whisper; run an HTTP STT server.
3. Install Tailscale; note the Mac's Tailscale hostname (for use away from home).

**Laptop (app):**
1. `pnpm install`; set `.env.local` with the Mac base URLs (LAN IP at home, Tailscale hostname away).
2. `pnpm dev` (Turbopack) for development; `pnpm build && pnpm start` for the installable PWA.
3. Install Tailscale; the app reaches the Mac over the tailnet when away.

**Verifying Mac connectivity:** `GET /api/llm/health` (Phase 0) pings Ollama and returns model list.

---

## 6. Phased roadmap

Legend per step — **Build** (what to make) · **Accept** (testable done-criteria) · **Verify** (how) · **Dep** (prereqs).
Phases ship in order; the app is genuinely usable from the end of **Phase 2** onward.

---

### Phase 0 — Foundation & seams *(no learner features; everything depends on this)*

**0.1 Scaffold project**
- Build: Next.js 16 + React 19 + Turbopack, TS strict, Tailwind v4, ESLint/Prettier, pnpm, base layout/theme.
- Accept: `pnpm dev` serves a styled placeholder home; `pnpm build` succeeds; lint clean.
- Verify: manual (page loads) + `pnpm build` green.

**0.2 AI agent guidance & skills** *(do this right after scaffolding so every later step inherits the conventions)*
- Build: author **`AGENTS.md`** (canonical guide — frame, seams, hard rules, commands, Definition of Done, "current phase" pointer) and a thin **`CLAUDE.md`** (`@AGENTS.md` import + Claude-Code notes). Create `.claude/skills/` with the baseline skills and `.claude/settings.json` quality gates.
  - Baseline skills: **`implement-plan-step`** (how to pick up a PLAN.md step: tests-first for pure logic → implement → run `verify` → run §3.5 close-out), **`seam-discipline`** (interfaces-only imports, concretes wired in `registry.ts`, no client→Mac calls, Zod-parse every LLM/agent output), **`stack-conventions`** (Next.js 16 / React 19 server-components-default, TS strict, Tailwind v4, Base-UI-via-`ui/`, accessibility, FSRS/Zod patterns).
  - Permissions: `.claude/settings.json` allows the `pnpm` commands so agents aren't prompted. Built-in `/code-review` (close-out) + `/security-review` (proxy/network/storage/audio changes) per §3.5.
  - Quality gate (**optional — may defer**): a **Husky** pre-commit hook (+ `lint-staged`) running `tsc --noEmit` + ESLint + targeted Vitest. Tool-agnostic (fires for any committer). Skip for now if it slows iteration; add it once the suite is worth gating on.
- Accept: `AGENTS.md` + `CLAUDE.md` exist and are accurate; baseline skills are present and invokable; `.claude/settings.json` permits `pnpm`. If the Husky gate is enabled, it blocks a deliberately introduced type/lint error.
- Verify: invoke each skill once (sanity) + manual doc review (+ if the Husky gate is enabled, trip it with a bad change and expect the commit to fail).

**0.3 UI component layer over Base UI**
- Build: install Base UI; create `ui/` wrappers — `Button`, `Dialog`, `Tooltip`, `Popover`, `Tabs`, `Input`, `Card`, `Progress`. Each wraps a Base UI primitive (or hand-built if missing) + Tailwind theme tokens.
- Accept: a `/dev/ui` gallery page renders every wrapper; no feature code imports Base UI directly.
- Verify: manual gallery review + grep check (no `@base-ui` import outside `ui/`).

**0.4 Dexie database + ContentRepository seam**
- Build: Dexie schema for all §4 tables; `ContentRepository` interface + Dexie impl; migrations/versioning.
- Accept: CRUD round-trips for `profile` and `cards`; schema versioned.
- Verify: Vitest against fake-indexeddb.
- _Done (deviation): Vitest + `fake-indexeddb` + a minimal `vitest.config.ts` and `pnpm test` were installed here (originally scoped to 0.8) so this seam self-verifies. The full harness — Playwright, `test:e2e`, and wiring `test` into `verify` — still lands in 0.8._

**0.5 LLMClient seam + server proxy**
- Build: `LLMClient` interface (`chat` with optional Zod schema + streaming, `embed`); Vercel-AI-SDK impl pointing at Ollama; `app/api/llm/` proxy; `app/api/llm/health`; a **mock** impl for tests.
- Accept: `health` returns Mac model list when reachable; `chat` returns a Zod-validated object for a trivial schema; mock works offline in tests.
- Verify: Vitest (mock + schema validation) + manual `/api/llm/health` against the real Mac.

**0.6 Config & Settings shell**
- Build: env loading (server-only); Settings page to view/override Mac endpoints + model names (persisted to `profile.settings`); connectivity indicator (online/offline + Mac reachable).
- Accept: changing endpoint in Settings routes subsequent calls there; indicator reflects real reachability.
- Verify: manual (toggle endpoints, kill Mac → indicator flips).
- _Done (notes): overrides live in `profile.settings` as planned; `Profile.cefrLevel` is now optional so the Settings shell works pre-onboarding ("onboarded" ⇔ `cefrLevel` set). Because server-side generation can't read the browser's IndexedDB, settings are also pushed to a **server-held runtime override** via `POST /api/llm/config` (restored on app load) — that's how `getLLMClient()` routes server-side calls. Composition root split into client-safe `lib/registry.ts` + server-only `lib/llm/server.ts` (dynamic import alone doesn't keep `server-only` out of the client graph). State-changing/Mac-calling POSTs get a same-origin CSRF guard — flag for the §3.5 `/security-review` at the Phase 0 close-out (0.8)._

**0.7 PWA shell (Serwist)**
- Build: `@serwist/next`, manifest via dynamic route handler, app-shell precache, offline fallback page; cache strategies per asset class (static=cache-first; lexicon/content=stale-while-revalidate; API=network-first).
- Accept: app installable; with network off, shell + an offline page load; with Mac off but net on, cached content still renders.
- Verify: Playwright offline test + manual install + Lighthouse PWA check. **⚠ Risk:** confirm Serwist↔Turbopack build works (see §8); if blocked, use Serwist's documented build step.
- _Done (notes): risk **resolved** — used **`@serwist/turbopack`** (not `@serwist/next`), which compiles `app/sw.ts` with esbuild inside `app/serwist/[path]/route.ts`; `pnpm build` (Turbopack) emits `/serwist/sw.js`, `/manifest.webmanifest`, `/~offline` with **no `--webpack`**. Approved native build scripts for `esbuild`/`@swc/core` (pnpm gate). Icons are placeholders (`public/icons`, `scripts/generate-icons.mjs`). The **Playwright offline test is deferred to 0.8** (e2e harness lands there); 0.7's automated check is the build emitting the SW/manifest/offline page — manual install + offline + Lighthouse are the user's checks._

**0.8 Test harness**
- Build: Vitest config (+ fake-indexeddb), Playwright config, npm scripts (`test`, `test:e2e`), a CI-style `verify` script.
- Accept: a sample unit + a sample e2e both run and pass.
- Verify: `pnpm test && pnpm test:e2e` green.
- _Done (notes): Vitest (+ fake-indexeddb) + `pnpm test` were already in place (brought forward in 0.4); 0.8 added Playwright (`@playwright/test`, chromium) with `playwright.config.ts` (auto-starts `pnpm dev`) and `tests/e2e/smoke.spec.ts` (2 specs green). `pnpm verify` now also runs **unit** tests; **e2e is intentionally NOT in `verify`** (browser + dev-server spin-up too heavy for the per-change gate) — run `pnpm test:e2e` separately / as its own CI job. The PWA offline Playwright test (deferred from 0.7) and the Husky pre-commit gate remain open, low-priority follow-ups. Fresh machines need `pnpm exec playwright install chromium`._
- _Phase 0 close-out (§3.5): `/code-review` + `/security-review` run. **Fixed:** added semantic status tokens (`success`/`warning`/`danger`) so the connectivity indicator + Settings banner stop hard-coding palette colors (hard rule #7); proxy routes now **redact upstream errors** (generic client message + server-side log, hard rule #8) and **cap request sizes** (chat ≤64 msgs ×20k chars, embeddings ≤256 ×10k — basic DoS guard). **Accepted residual risk** (single-user/local/no-auth per §1): the user-set `baseURL` is SSRF-shaped and the runtime override persists until restart; the same-origin guard blocks cross-origin callers, full mitigation (auth / allow-list) deferred to any multi-user/cloud move. **Deferred follow-ups:** stream abort/`request.signal` wiring, Playwright offline test, Husky gate._

---

### Phase 1 — Data backbone & content infrastructure

**1.1 Bundle WordNet + build local query**
- Build: import a WordNet subset into `data/`; `lib/lexicon` queries for definition, synonyms, hypernyms/hyponyms; load into IndexedDB or query in-memory.
- Accept: `relations("hatchback")` returns hypernym "car"; `define("fine")` returns multiple senses.
- Verify: Vitest fixtures.

**1.2 Bundle Words-CEFR-Dataset + CEFR lookup**
- Build: import dataset to `data/`; `cefrLevel(word, pos?)` returns an estimated level.
- Accept: known A1 word → A1; known B2 word → B2; unknown → graceful null.
- Verify: Vitest.

**1.3 LexiconProvider seam (definitions/relations/CEFR/audio)**
- Build: `LexiconProvider` interface + impl combining 1.1/1.2 + Free Dictionary API for audio/extra senses (cached to `lexiconCache`); offline-first (cache → bundled → network).
- Accept: lookups work offline from bundle/cache; audio fetched + cached when online.
- Verify: Vitest (mock network) + manual online audio fetch.

**1.4 CEFR grammar progression map**
- Build: author `data/grammar-map` — ordered grammar constructions tagged by CEFR (past continuous, relative clauses, conditionals, …) with detect-heuristics/markers.
- Accept: map covers A1–C2; lookup "what level is construction X" works.
- Verify: Vitest snapshot of the map's level coverage.

**1.5 ContentValidator (the quality gate)**
- Build: `validate(text, targetCefr)` → parse words → flag any above target CEFR; detect grammar constructions above target via the grammar map; return structured violations.
- Accept: a sentence with a C1 word fails for target A2 with the offending word named; clean A2 sentence passes.
- Verify: Vitest with curated pass/fail sentences.

**1.6 Embedding-based semantic search**
- Build: `LLMClient.embed` via Ollama embedding model; store embeddings on `content`/`cards`; cosine-similarity search helper.
- Accept: "find related words/passages" returns sensible neighbors for a seed query.
- Verify: Vitest (precomputed vectors) + manual spot-check against the Mac.

**1.7 Generate-and-cache pipeline**
- Build: `lib/content` orchestrator implementing §2.4 (generate → validate → corrective retry → cache). Generic over content type + Zod schema.
- Accept: requesting an A2 passage on a topic yields a cached, CEFR-valid passage; a deliberately hard prompt triggers a corrective retry.
- Verify: Vitest (mock LLM returning over-level text → expect retry) + manual against the Mac.

**1.8 Tiny starter seed**
- Build: author/generate-then-hand-check a few passages + a starter vocab deck per CEFR level; bundle in `data/seed`; load on first run.
- Accept: fresh install (Mac off, net off) shows seed passages + a starter deck.
- Verify: Playwright offline first-run test.

---

### Phase 2 — Onboarding + Vocabulary SRS *(first genuinely usable app)*

**2.1 Placement quiz (adaptive vocab yes/no)**
- Build: sample CEFR-graded words (+ pseudowords for over-claim detection); known/unknown UI; map vocab-size estimate → CEFR; write to `profile`. Fully offline.
- Accept: consistent yes-patterns yield a stable level; pseudoword "yes" rate lowers confidence/adjusts estimate.
- Verify: Vitest (scoring fn) + Playwright (complete onboarding → profile saved).

**2.2 Learner profile & goals**
- Build: capture goals (travel/work/exam/general); store level + goals; editable in Settings.
- Accept: profile persists across reloads; editing updates it.
- Verify: Playwright.

**2.3 FSRS engine wrapper**
- Build: `lib/srs` over `ts-fsrs`: card init, schedule on rating (Again/Hard/Good/Easy), due-queue selection.
- Accept: ratings advance/reset intervals per FSRS; due queue returns only due cards.
- Verify: Vitest (deterministic scheduling cases).

**2.4 Review session UI**
- Build: review flow (prompt → reveal → rate), session summary; pulls due cards.
- Accept: a full review session updates card states + due dates.
- Verify: Playwright (review-card smoke test).

**2.5 Add-to-deck**
- Build: add words from lexicon lookups and the starter deck; dedupe; attach definition/sense/CEFR.
- Accept: adding a word creates a card scheduled for today.
- Verify: Vitest + manual.

**2.6 Light gamification (wired to reviews)**
- Build: `lib/gamification` pure functions — XP per activity, XP→level, daily streak (local date logic), ~5 milestone achievements; HUD (XP, level, streak).
- Accept: completing a review grants XP; consecutive-day use increments streak; same-day repeat doesn't; crossing a threshold unlocks an achievement.
- Verify: Vitest (streak/level/achievement logic with injected dates) + manual HUD.

> **Milestone:** after Phase 2 you have a daily-usable vocab tutor with placement, SRS, and motivation — fully offline.

---

### Phase 3 — Reading module

**3.1 Topic → passage generation**
- Build: topic picker; generate level-appropriate passage via pipeline (1.7); cache; library of cached passages.
- Accept: picking a topic at the profile level yields a CEFR-valid cached passage; re-open works offline.
- Verify: Playwright (generate online → reload offline → still there) + manual.

**3.2 Reader with tap-to-define**
- Build: passage reader; tap any word → Tooltip/Popover with definition, phonetic, audio, examples (LexiconProvider, offline-first).
- Accept: tapping a word shows data offline from bundle/cache; audio plays when available.
- Verify: Playwright + manual.

**3.3 Tap-to-add-to-SRS**
- Build: "add to deck" from the tap popover (reuses 2.5).
- Accept: tapped word becomes a due card.
- Verify: Playwright.

**3.4 Comprehension questions + diagnostics start**
- Build: generate comprehension Qs (Zod schema); grade; `lib/diagnostics` error-event model; emit tagged events (skill=reading, category, cefr, context).
- Accept: wrong answers create `errorEvents` with correct tags.
- Verify: Vitest (event creation) + Playwright (answer wrong → event stored).

**3.5 Runtime enrichment agent v1**
- Build: `lib/agent` — on missing word/topic + online: research (LLMClient + web fetch tool), structure (Zod), **validate (1.5)**, display, cache to `lexiconCache`/`content`. Show a clear "researching…" state; fail gracefully offline.
- Accept: a word absent from bundle triggers research online, is validated, shown, and served offline next time; offline → graceful "unavailable, connect to Mac."
- Verify: Playwright (mock agent online → cached → offline hit) + manual against the Mac.

---

### Phase 4 — Writing module

**4.1 Writing prompts**
- Build: level-appropriate prompts (seed + generated); prompt picker.
- Accept: prompts match profile level; cached for offline reuse.
- Verify: manual + Playwright.

**4.2 Structured feedback**
- Build: submit text → `LLMClient.chat` with the corrections Zod schema (overall score, structural grade, per-correction original/corrected/category/explanation); render feedback UI; revision loop.
- Accept: a sentence with subject-verb + adverb errors returns structured corrections matching the schema.
- Verify: Vitest (schema parse on a fixed model response) + manual against the Mac.

**4.3 Writing diagnostics**
- Build: map corrections → `errorEvents` (category, cefr, context); feed weakness model.
- Accept: each correction creates a tagged event.
- Verify: Vitest.

---

### Phase 5 — Listening module

**5.1 TTS playback**
- Build: browser `SpeechSynthesis`; configurable rate + accent/voice; play sentences/passages.
- Accept: plays target text; rate/voice settings apply; works offline (browser voices).
- Verify: manual (audio) + unit test for the wrapper's option mapping.

**5.2 Dictation + WER scoring**
- Build: play → user transcribes → `lib/diagnostics` WER vs reference (in a worker if large); show errors.
- Accept: known reference/hypothesis pairs yield correct WER; mistakes emit `errorEvents` (skill=listening).
- Verify: Vitest (WER cases) + Playwright.

**5.3 Listening comprehension**
- Build: generated audio scripts + comprehension Qs; diagnostics events.
- Accept: flow completes; events tagged.
- Verify: Playwright.

---

### Phase 6 — Speaking module

**6.1 Mic capture + normalize**
- Build: `MediaRecorder` capture; normalize to 16 kHz mono (worker); permission UX.
- Accept: produces a 16 kHz mono blob; handles denied permission gracefully.
- Verify: manual + unit test for the normalize step.

**6.2 Whisper transcription (Transcriber seam)**
- Build: `Transcriber` interface; impl → Mac whisper-server via `app/api/stt/`; "needs Mac" offline messaging.
- Accept: recorded audio returns a transcript when the Mac is reachable; clear failure offline.
- Verify: manual against whisper-server + Vitest (mock transcriber).

**6.3 Pronunciation scoring**
- Build: phonetic Levenshtein / WER vs reference → per-word accuracy; (Azure optional later behind the seam); diagnostics events (skill=speaking, phonetic category).
- Accept: clear mispronunciation lowers the score vs a clean read; events tagged.
- Verify: Vitest (alignment on fixtures) + manual.

---

### Phase 7 — Diagnostics dashboard, heatmap & adaptive selection

**7.1 Weakness model rollup**
- Build: recompute `weakness` (skill × category × cefr) from `errorEvents` with recency weighting.
- Accept: repeated errors in a category raise its weakness score; decay over time.
- Verify: Vitest (event streams → expected scores).

**7.2 Heatmap dashboard**
- Build: visualize weakness model (skill × category × CEFR); mastery levels; drill-down to example contexts.
- Accept: dashboard reflects stored events; empty state handled.
- Verify: Playwright + manual.

**7.3 Adaptive content selection**
- Build: bias passage topics / quiz items / review emphasis toward high-weakness categories across modules.
- Accept: with seeded weaknesses, generated/selected content over-samples weak categories.
- Verify: Vitest (selection fn given a weakness profile) + manual.

**7.4 (Optional) exam/level-check mode**
- Build: a short mixed 4-skill check that re-estimates CEFR and snapshots progress.
- Accept: produces a level estimate + a saved snapshot.
- Verify: Playwright.

---

### Phase 8 — Polish & hardening

**8.1 Offline/caching polish** — tune Serwist strategies per §2.2; verify all "offline ✅" rows hold. *Verify:* Playwright offline matrix.
**8.2 Backup** — JSON export/import of all IndexedDB data; round-trip restore. *Verify:* Vitest + Playwright.
**8.3 Settings completeness** — endpoints, model names, TTS prefs, accent; runtime overrides. *Verify:* manual.
**8.4 UX motion** — Framer Motion transitions, celebratory moments, loading/skeleton states. *Verify:* manual.
**8.5 Performance** — IndexedDB indexes, lazy routes, model warm-up ping, embedding batch. *Verify:* manual profiling + Lighthouse.
**8.6 Final gamification pass** — achievement copy/icons, streak edge cases (timezone/day-boundary). *Verify:* Vitest date-edge tests.

---

## 7. Build order rationale
0 before all (seams + shell); within it, **0.2 (agent docs, skills, quality gates) comes right after scaffolding** so every later step inherits the conventions. 1 before 2 (SRS/placement need lexicon + CEFR data). 2 is the first shippable app. 3→6 each add one skill and reuse the same pipeline/diagnostics. 7 needs events from 3–6 to be meaningful. 8 hardens. Diagnostics and gamification are **threaded through** 2–6, not bolted on at the end.

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| **Serwist ↔ Turbopack** build friction (historically Workbox forced Webpack) | Validate in 0.7 early; use `@serwist/next`'s supported build path; if blocked, isolate SW build step. Don't let it block 0.1–0.6. |
| **Base UI immaturity** (missing components / API churn) | All usage behind `ui/` wrappers (0.3); hand-build missing primitives; swap lib later without touching features. |
| **Agent-doc / skill drift** (AGENTS.md, CLAUDE.md, skills go stale) | Per-phase close-out (§3.5) updates them; treated as part of Definition of Done. |
| **Mac unreachable** (asleep/away) | Offline backbone + generate-and-cache (§2.2); clear "connect to Mac" states; consider keep-awake on the Mac. |
| **Mixed-content/CORS** | Server-side proxy only (§2.1); browser never calls the Mac directly. |
| **14B output quality / JSON drift** | Zod validation + corrective retries (2.4/1.7); utility model for cheap checks; primary model swappable. |
| **CEFR data is "estimated"** | Treat as guidance not truth; validator flags, doesn't hard-block learning; enrichment agent improves coverage over time. |
| **Whisper server setup** | Isolated to Phase 6 behind `Transcriber`; app fully functional through Phase 5 without it. |
| **Scope creep (full 4 skills)** | Phase gates; each phase must ship + pass its tests before the next. |
| **Single-device data loss** | JSON export/import (8.2); revisit cloud sync only if multi-device need is real (the seam is ready). |

## 9. Legal/content note
All bundled data must be license-clean for redistribution (WordNet = OK; Words-CEFR-Dataset = check its license; Free Dictionary/Wiktionary content = attribute per terms). The enrichment agent stores **structured facts**, not copied prose, and everything passes the validator. Oxford/WordsAPI/Cambridge EVP/EGP are **excluded** as non-redistributable/paid.

## 10. Explicitly dropped from the original guide (and why)
Supabase/PostgreSQL/RLS, MVCC/WAL tuning, batched cloud sync, multi-user, WebSockets (→ single-user local) · in-browser **WebLLM/WebGPU** (→ Mac models, higher quality) · **Oxford/WordsAPI/Cambridge** APIs (→ free/open bundled data) · **Azure** pronunciation as the primary (→ local Whisper + phonetic WER; Azure is an optional later swap) · big **pre-generated content library** (→ generate-and-cache + tiny seed) · async serverless/DB-trigger **gamification** (→ local instant) · **SM2/DolphinSR** (→ FSRS) · **dedicated-exam-first diagnostics** (→ continuous).

---

## 11. Open items to revisit later (not blocking v1)
- Cloud sync / multi-device (the first real reason to re-introduce a backend).
- Optional cloud LLM/STT swap-in for quality or when away from the Mac (seams already support it).
- Badge catalog / quests / richer gamification (Moderate tier).
- Dedicated exam mode depth (7.4).
- Conversation/speaking-practice free dialogue mode.
```

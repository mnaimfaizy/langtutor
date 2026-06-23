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
- **Phase 1 — Data backbone & content infrastructure — ✅ complete** (all 8 steps + `/code-review` + `/security-review`).
- **Phase 2 — Onboarding + Vocabulary SRS — ✅ complete** (all 6 steps + `/code-review` + top-3 review fixes).
- **Phase 3 — Reading module — ✅ complete** (all 5 steps + `/code-review` + `/security-review` + close-out fixes).
- Done (Phase 3): **3.1** Topic → passage generation · **3.2** Tap-to-define word popover · **3.3** Tap-to-add to SRS · **3.4** Comprehension quiz + diagnostics · **3.5** Runtime enrichment agent.
- **Phase 4 — Writing module — ✅ complete** (all 3 steps + `/code-review` + `/security-review` + close-out fixes).
- Done (Phase 4): **4.1** Writing prompts: seed (12 prompts A1–C2) + generator + picker · **4.2** Structured feedback: Zod schema, API route, feedback UI + revision loop · **4.3** Writing diagnostics: corrections → `errorEvents`.
- **Next: Phase 5.1** — TTS playback: `SpeechSynthesis` wrapper; configurable rate + voice; play sentences/passages.
- **Phase 4 close-out notes:**
  - **Writing prompts (4.1):** `lib/content/prompt.ts` — `PromptSchema`, `WRITING_TOPICS`, `buildPromptMessages(topic, level)`. `POST /api/writing/generate` uses `generateContent()` pipeline with `NullContentRepository` + `NullContentValidator` (prompts are teacher-voice; CEFR gating intentionally bypassed — see seam note below). Client saves to IndexedDB, navigates to `/writing/[id]`. `writing-client.tsx` manages topic picker + level selector + library list. Seed: 12 prompts (2 per level A1–C2) added to `lib/content/seed.ts`.
  - **Seed idempotency fix (4.1 close-out):** `loadSeedIfEmpty` now checks passages, prompts, and cards independently via `Promise.all`. Cards previously bundled with passages are now guarded by a separate `cardsDone = allCards.length >= SEED_CARDS.length` check, fixing a data-loss edge case where passages loaded but cards did not.
  - **`SeedBootstrap` (4.1):** Updated to show `{passages} passages · {prompts} prompts · {cards} cards ready offline`. Queries by type+source to count separately.
  - **Structured feedback (4.2):** `lib/content/feedback.ts` — `CorrectionSchema` (original/corrected/category/explanation, all with string length caps), `FeedbackSchema` (overallScore 0–10 int, structuralGrade as `z.enum(["Excellent","Good","Developing","Needs Work"])`, corrections array `.max(50)`). `POST /api/writing/feedback` — origin-guarded; draft `.max(4000)`; explicit `FeedbackSchema.parse(raw)` at route boundary before returning. `prompt-view.tsx` — `SubmitPhase = "idle"|"submitting"|"done"|"error"`; `inFlight` ref double-submit guard; revision loop (Revise resets to idle without clearing draft).
  - **Writing diagnostics (4.3):** `lib/diagnostics/writing.ts` — `createWritingErrorEvents(corrections, cefr, now?)` maps each `Correction` to a `NewErrorEvent` with `skill:"writing"`, `category`, `cefr`, `context = correction.original`. Called in `prompt-view.tsx` after feedback lands; per-event `try/catch` matches reading quiz pattern.
  - **Validator bug fix:** `lib/content/content-validator.ts` — pure-numeric tokens (`/^\d+$/`) now skipped in word-violation detection; numbers are not vocabulary items.
  - **NullContentValidator seam note:** `app/api/writing/generate/route.ts` defines `NullContentValidator` (always `{ ok: true }`) locally — writing prompt instructions are teacher-voice and intentionally bypass word/grammar gating. The pipeline still handles parse-error retries. This pattern is a known limitation; a future `skipValidation` option on `generateContent` would make the intent explicit at the design level.
  - **NullContentRepository duplication:** verbatim 65-line class exists in both `app/api/writing/generate/route.ts` and `app/api/reading/generate/route.ts` — deferred cleanup; extract to `lib/content/null-adapters.ts` before adding a third generate route.
  - **CEFR_COLOR duplication:** `Record<Cefr, string>` mapping copied across 6 files — deferred cleanup; extract to `lib/cefr.ts` or a shared `ui/` helper.
- **Phase 3 close-out notes:**
  - **Passage generation (3.1):** `lib/content/passage.ts` — `PassageSchema`, `READING_TOPICS`, `buildPassageMessages(topic, level)`. `POST /api/reading/generate` uses `generateContent()` pipeline with `NullContentRepository` (server has no Dexie); client saves result to IndexedDB and navigates to `/reading/[id]`. `reading-client.tsx` manages topic/level picker + library list.
  - **LLM client compatibility fix:** `OllamaLLMClient.chat()` switched from `generateObject` → `generateText` + `extractJson()` for compatibility with LM Studio and Ollama builds that reject `response_format:json_object`. `extractJson` handles raw JSON, markdown fences, and embedded `{…}` blocks.
  - **Pipeline parse-error retry (close-out fix):** `lib/content/pipeline.ts` — `llmClient.chat()` call is now wrapped in `try/catch`; a `SyntaxError` or `ZodError` on a non-final attempt triggers `continue` (retry with same messages) rather than propagating and bypassing all remaining retries.
  - **Tap-to-define (3.2):** `app/reading/[id]/word-popover.tsx` — `LookupState` union; offline-first cache via `repo.getLexiconEntry` → `PUT /api/lexicon/define` → `repo.putLexiconEntry`. `ui/popover.tsx` gains `PopoverInlineTrigger` (inline word-style, no button chrome).
  - **Tap-to-add (3.3):** `AddToDeckButton` inside `WordPopover`; `AddState = "idle"|"adding"|"added"|"duplicate"|"error"`. Reuses `buildNewCard`/`isDuplicate` from `lib/deck`. `cefr ?? "B1"` fallback for nullable CEFR. `researchingRef` guard added at close-out to prevent double-tap on the Research button.
  - **Comprehension quiz (3.4):** `app/reading/[id]/comprehension-quiz.tsx` — phases `idle|loading|answering|result|error`. `handleSubmit` wrapped in `try/catch` so UI always reaches `result` phase even if an IndexedDB write fails. `lib/content/comprehension.ts` — `ComprehensionQuestionSchema`, `ComprehensionQsSchema`, `buildQuestionsMessages`. `POST /api/reading/questions` (origin-guarded, `body.max(8000)`).
  - **Diagnostics (3.4):** `lib/diagnostics/reading.ts` — `createReadingErrorEvent({ question, category, cefr, now? })` → `NewErrorEvent` with `skill:"reading"`, question text as `context`. `lib/diagnostics/index.ts` re-exports it.
  - **Runtime enrichment agent (3.5):** `lib/agent/research-word.ts` (server-only) — `researchWord(word, llmClient)` with tolerant `AgentWordSchema` (definition: string|string[]→string with min(1); pos: "noun"→"n" map; cefr: regex extract from verbose strings). `POST /api/agent/research-word` returns `DefineFound` shape; 502 on Mac unavailable. `WordPopover` gains `researching` + `offline` states.
  - **`GET /api/lexicon/define`** — word param capped at 100 chars (close-out security fix). Calls Free Dictionary API for phonetic/audioUrl; `encodeURIComponent` prevents path injection.
  - **Seam note:** `app/api/reading/generate/route.ts` uses `ContentValidator` interface type (not `LocalContentValidator` concrete) for `_validator` and `getValidator()` return type — Rule 2 compliant.
- **Phase 2 close-out notes:**
  - **SRS (2.3):** `lib/srs/` — `initCard(now)`, `scheduleCard(fsrs, rating, now)`, `getDueCards(cards, now)`, `isDue(fsrs, now)`. `SrsRating = "again" | "hard" | "good" | "easy"`. Wraps `ts-fsrs` v5.4.1; `FsrsState.learningSteps` optional (defaults to 0 for old cards).
  - **Placement quiz (2.1):** `lib/placement/quiz-engine.ts` — `buildQuizBatch(level)`, `shouldAdvance(answers)`, `scoreQuiz(answers)`. Word list in `lib/placement/word-list.ts`; pseudowords baked in. `CEFR_ORDER` exported for shared level ordering. Word order is deterministic — shuffle in `buildQuizBatch` is a Phase 3+ improvement.
  - **Review session (2.4):** `app/review/review-session.tsx` — phases `loading | empty | reviewing | summary | error`. `handleRate` protected by `ratingInFlight` ref (double-tap guard) and `try/catch` → `"error"` phase with retry button. `applyReview` called on session completion; result shown in summary (+XP, level-up, achievements).
  - **Add-to-deck (2.5):** `lib/deck/` — `buildNewCard(data, now)`, `isDuplicate(word, existing)`. Lookup API: `GET /api/lexicon/lookup?word=` (200 found/not-found, 400 missing, 503 data not built).
  - **Gamification (2.6):** `lib/gamification/` — `earnXp(n)` (10 XP/card), `xpToLevel(xp)` (non-linear thresholds), `updateStreak(last, today, count)`, `applyReview(state, {cardCount, today, now})`. 5 achievements: `first_review`, `xp_50`, `xp_200`, `streak_3`, `streak_7`. `GamificationHud` in layout header; re-fetches on `usePathname` change.
  - **Streak date note:** `today` in `handleRate` uses `now.toISOString().slice(0,10)` (UTC). Both writer and reader (`dayBefore` in streak.ts) use UTC consistently, so behavior is self-consistent but may misalign with local midnight in UTC− timezones. A future fix: use `Intl.DateTimeFormat` for local-date strings.
  - **Onboarding flow:** quiz → `/onboarding/goals` → home. "Onboarded" ⇔ `profile.cefrLevel` set. Nav links on home page (Review / Add words) are accessible before onboarding — by design for MVP; add a redirect guard in Phase 3 if needed.
  - **`answeringRef` guard (2.1):** `handleAnswer` in `placement-quiz.tsx` uses a `useRef` flag to prevent double-tap from firing twice before React re-renders.
- **Phase 1 close-out notes:**
  - `lib/lexicon/server.ts` — server-only `getLexiconProvider()` (mirrors `lib/llm/server.ts`). Audio caching **omitted** on the server (`repo: null`) — IndexedDB is browser-only. Client-side audio caching wired in Phase 3.2.
  - `lib/lexicon/data-loader.ts` — `readFileSync` with a dev-friendly ENOENT message pointing to build scripts.
  - `data/grammar-map.json` Zod-validated at module load — authoring typos surface at startup.
  - `LocalContentValidator` pre-compiles regex markers in the constructor.
  - Pipeline corrective-retry sends `JSON.stringify(parsed)` (not just the text field).
  - **Generated data files** (`data/wordnet.json`, `data/words-cefr.json`) are **gitignored**. Fresh-checkout setup: `pnpm install && node scripts/build-wordnet.mjs && node scripts/build-words-cefr.mjs` (CEFR script needs internet).
  - **Starter seed (1.8):** `lib/content/seed.ts` — 8 passages (A1×2/A2×2/B1×2/B2×2) + 20 cards (5/level A1–B2); `loadSeedIfEmpty(repo)` idempotency guards on `passages.length >= SEED_PASSAGE_COUNT` (not `> 0`) so a partial-load failure is retried. `SeedBootstrap` client component loads seed on mount; `data-testid="seed-ready"` bar visible after load.
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

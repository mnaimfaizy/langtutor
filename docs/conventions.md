# Conventions — Lang-Tutor

> Repo structure, coding conventions, and one-time setup for the lang-tutor PWA.

## 1. Repo structure

```
lang-tutor/
├─ app/                       # Next.js App Router
│  ├─ reading/                # reading module (library + [id] passage view)
│  ├─ writing/                # writing module (library + [id] prompt view)
│  ├─ listening/              # listening module (library + [id] dictation view)
│  ├─ speaking/               # speaking module (library + [id] speaking view)
│  ├─ review/                 # SRS review session
│  ├─ deck/                   # vocab deck management / add words
│  ├─ diagnostics/            # weakness heatmap
│  ├─ onboarding/             # placement quiz + goals
│  ├─ settings/               # Mac endpoint, model, TTS prefs, export/import
│  └─ api/                    # server route handlers (the ONLY callers of the Mac)
│     ├─ llm/                 # proxy → Ollama chat/embeddings/health/warmup
│     ├─ stt/                 # proxy → whisper-server
│     ├─ reading/             # generate + questions
│     ├─ writing/             # generate + feedback
│     ├─ lexicon/             # define + lookup
│     └─ agent/               # research-word enrichment agent
├─ lib/
│  ├─ llm/                    # LLMClient seam + prompts + Zod schemas
│  ├─ lexicon/                # LexiconProvider seam + WordNet/CEFR/dictionary impls
│  ├─ content/                # generate-validate-cache pipeline, ContentValidator
│  ├─ srs/                    # ts-fsrs wrapper, review queue
│  ├─ diagnostics/            # error-event model, weakness model, WER
│  ├─ gamification/           # XP/streak/level/achievements (pure functions)
│  ├─ db/                     # Dexie schema + ContentRepository
│  ├─ agent/                  # runtime enrichment agent
│  ├─ transcriber/            # Transcriber seam + whisper impl + runtime-config
│  ├─ audio/                  # audio normalize helpers + useRecorder hook
│  ├─ tts/                    # SpeechSynthesis wrapper
│  ├─ placement/              # placement quiz engine + word list
│  ├─ deck/                   # buildNewCard, isDuplicate
│  ├─ backup/                 # BackupSchema, export/import helpers
│  └─ registry.ts             # composition root: wires concretes to seams
├─ ui/                        # our component layer wrapping Base UI
├─ data/                      # bundled datasets (WordNet subset, Words-CEFR, grammar map, seed)
├─ workers/                   # web workers (WER, audio normalize)
├─ tests/                     # Vitest unit + Playwright e2e
├─ docs/                      # architecture, conventions, decisions, roadmap history
└─ .claude/                   # skills/ + settings.json
```

## 2. Coding conventions

- **TypeScript strict**; no `any` in committed code. All LLM/agent outputs parsed through **Zod** before use.
- **Server components by default**; client components only where interactivity requires.
- All Mac access goes through `app/api/*` → seam. **No client-side calls to the Mac.**
- Pure logic (FSRS, validator, WER, gamification, weakness model) lives in `lib/` as **side-effect-free functions** → unit-testable without a browser.
- Env vars: `MAC_LLM_BASE_URL`, `MAC_LLM_MODEL`, `MAC_UTILITY_MODEL`, `MAC_EMBED_MODEL`, `MAC_STT_URL` in `.env.local` (server-only). A Settings UI can override at runtime (stored in IndexedDB and pushed to the server via `POST /api/llm/config` and `POST /api/stt/config`).
- Status/state colors: use `bg-success`/`text-success`, `bg-warning`, `bg-danger`/`text-danger` — never raw palette utilities (Hard Rule #7). Defined in `app/globals.css` (light + dark).
- **Base UI** ships as `@base-ui/react`; all usage must be wrapped in `ui/` wrappers.

## 3. Definition of Done (every feature/issue)

A feature is **done** when:

- Code compiles & lints clean (`pnpm verify` green)
- Acceptance criteria pass
- No regression in existing Vitest/Playwright suites
- At close-out: `/code-review` run; add `/security-review` if the change touched the proxy, networking, storage, or audio capture

## 4. Dev workflow & one-time setup

**Mac (server):**

1. Install Ollama; pull primary ~14B, utility ~7B, embedding model. `ollama serve`.
2. Install whisper.cpp or faster-whisper; run an HTTP STT server. (See `docs/whisper-mac-setup.md`.)
3. Install Tailscale; note the Mac's Tailscale hostname (for use away from home).

**Laptop (app):**

1. `pnpm install`; copy `.env.example` → `.env.local` and set the Mac base URLs (LAN IP at home, Tailscale hostname away).
2. Build the bundled data: `node scripts/build-wordnet.mjs && node scripts/build-words-cefr.mjs` (CEFR script needs internet). Generated files (`data/wordnet.json`, `data/words-cefr.json`) are gitignored.
3. `pnpm dev` (Turbopack) for development; `pnpm build && pnpm start` for the installable PWA.
4. Fresh machines: `pnpm exec playwright install chromium` for e2e tests.

**Verifying Mac connectivity:** `GET /api/llm/health` pings Ollama and returns the model list.

# Sandcastle sandbox — environment contract

> **Read this before running anything.** It exists so you do not re-discover known
> environment facts. Past runs wasted 10–30 minutes each re-proving the items below.

## What works (verified)

| Command                            | Notes                                                                |
| ---------------------------------- | -------------------------------------------------------------------- |
| `pnpm verify`                      | The required CI gate. Typecheck + lint + format:check + unit tests.  |
| `pnpm test` / `pnpm test:watch`    | Vitest, node env + fake-indexeddb. No browser needed.                |
| `pnpm dev` / `pnpm build`          | Turbopack root is pinned in `next.config.ts` — boots normally.       |
| `pnpm exec playwright test <spec>` | Chromium (OS deps + browser binary) is baked into the image at       |
|                                    | `/ms-playwright` (`PLAYWRIGHT_BROWSERS_PATH`). Works out of the box. |
| `gh` (GitHub CLI)                  | Authenticated; used for issue view/close.                            |

## Hard bans — never run these

- **`sudo` or `apt-get`** — you are a non-root user; there is no sudo. These hang or fail.
  All OS packages you need are already in the image. If one is missing, that is a blocker:
  comment on the issue and stop.
- **`playwright install --with-deps`** — tries to call apt via sudo and hangs silently
  (~10 min observed). The deps are already installed. If the browser binary is missing,
  `pnpm exec playwright install chromium` (no `--with-deps`) is safe — it installs to the
  container-native `/ms-playwright` path, never to a bind mount.
- **Wiping `node_modules` / the pnpm store more than once.** See anti-thrash rule below.

## Anti-thrash rule

If typecheck/lint/test errors appear **in files you did not touch**, suspect the environment,
not the source:

1. Run the failing gate once more (transient FS races happen on the 9P bind mount).
2. If it persists, run the exact install command once:
   `pnpm install --prefer-offline --frozen-lockfile --store-dir /home/agent/.local/share/pnpm/store --virtual-store-dir /home/agent/.pnpm-virtual-store`
3. If it **still** persists, stop. Comment on the issue with the error and do not "fix"
   pre-existing errors in unrelated files as part of your change.

Do not enter an edit → revert → reinstall → re-apply loop. One reinstall attempt, maximum.

## E2E policy

- Run **only the Playwright specs affected by your change** (plus any new specs you wrote):
  `pnpm exec playwright test tests/e2e/<spec>.spec.ts`
- Playwright auto-starts the dev server (see `playwright.config.ts`); do not start one manually.
- The suite is single-worker and slow — do not run the full suite unless the issue asks for it.
- If e2e cannot run for an environment reason not covered here, validate specs with
  `pnpm exec playwright test --list`, note the caveat in your closing comment, and update
  this file's "Known issues" section as part of your commit.

## Known issues

- Filesystem I/O on the workspace is slow (Windows→Linux 9P bind mount). Prefer targeted
  commands (single spec, single test file) over broad ones. Cold Turbopack compiles take
  10–30 s per route; the e2e auth setup already has a 300 s budget to absorb this.
- **(issue #57, RESOLVED) Turbopack "couldn't find the Next.js package" boot failure**:
  the pnpm virtual store lives outside the workspace (native FS, for 9P performance), so
  `node_modules` symlinks resolve to realpaths that escape the project root and Turbopack
  refused to compile. Fixed: the image sets `LANGTUTOR_TURBOPACK_ROOT=/home/agent` and
  `next.config.ts` widens `turbopack.root` accordingly. `pnpm dev` and
  `pnpm exec playwright test <spec>` now work in this sandbox — verified end-to-end
  (smoke suite green). Do not re-diagnose; if you see this error, the image is stale —
  comment on the issue and stop.
- **API routes 404 under `pnpm dev` after a `next.config.ts` change**: the Turbopack
  dev cache in `.next/` can go stale when config changes between boots, making API
  routes (e.g. `/api/auth/*`) return 404 while pages still render. Fix: `rm -rf .next`
  and restart. A fresh worktree has no `.next`, so this only bites after you edit config.
- `data/wordnet.json` and `data/words-cefr.json` are gitignored and copied into the
  worktree by a host hook. If they are missing, lexicon API routes crash the dev server
  (ECONNRESET) — do not chase this as a code bug; note it on the issue instead.
- (Add new, verified environment findings here — with the run/issue number — so the next
  agent does not re-discover them.)

# Sandcastle sandbox — environment contract

> **Read this before running anything.** It exists so you do not re-discover known
> environment facts. Past runs wasted 10–30 minutes each re-proving the items below.

## What works (verified)

| Command                            | Notes                                                               |
| ---------------------------------- | ------------------------------------------------------------------- |
| `pnpm verify`                      | The required CI gate. Typecheck + lint + format:check + unit tests. |
| `pnpm test` / `pnpm test:watch`    | Vitest, node env + fake-indexeddb. No browser needed.               |
| `pnpm dev` / `pnpm build`          | Turbopack root is pinned in `next.config.ts` — boots normally.      |
| `pnpm exec playwright test <spec>` | Chromium OS deps are baked into the image; the browser binary is    |
|                                    | installed by a sandbox-ready hook into a persistent host-mounted    |
|                                    | cache (`~/.cache/ms-playwright`).                                   |
| `gh` (GitHub CLI)                  | Authenticated; used for issue view/close.                           |

## Hard bans — never run these

- **`sudo` or `apt-get`** — you are a non-root user; there is no sudo. These hang or fail.
  All OS packages you need are already in the image. If one is missing, that is a blocker:
  comment on the issue and stop.
- **`playwright install --with-deps`** — tries to call apt via sudo and hangs silently
  (~10 min observed). The deps are already installed. If the browser binary is missing,
  `pnpm exec playwright install chromium` (no `--with-deps`) is safe and hits the mounted cache.
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
  commands (single spec, single test file) over broad ones.
- (Add new, verified environment findings here — with the run/issue number — so the next
  agent does not re-discover them.)

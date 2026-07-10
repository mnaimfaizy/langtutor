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
- **`pkill` / `killall` (any form, including the old "bracket trick").** With `-f`, `pkill`
  matches the _full command line_ of every process — including the shell running your own
  `pkill` — so it self-signals and aborts the run (issue #62: exit 137 on `playwright`,
  exit 143 on `next dev`). The bracket form (`pkill -f 'next[ ]dev'`) is **also banned**:
  the agent launch argv embeds this entire contract, so the literal text of the pattern
  appears in the agent process cmdline and `pkill` SIGTERMs the agent (issue #108 run:
  exit 143 mid-cleanup). True for **any** pattern. Kill by numeric PID only (`kill <pid>`).

## Process cleanup

Don't kill anything — Playwright starts and `SIGTERM`s its own dev server per invocation. Between
e2e runs, just clear stale build/db state: `rm -rf .next && rm -f langtutor-e2e.db*`.

If a wedged server is genuinely still listening and a kill is unavoidable:

1. List PIDs with `ps` / `pgrep` (read-only).
2. `kill <pid>` (then `kill -9 <pid>` only if it ignores SIGTERM).
3. Never `pkill` / `killall`.

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

- Run **only the specs affected by your change**, plus any new specs, in a **single** invocation:
  `pnpm exec playwright test tests/e2e/a.spec.ts tests/e2e/b.spec.ts`. Playwright auto-starts the
  dev server — never start one manually, never run the full suite unless the issue asks.
- **Run e2e once. Do not retry on failure.** The sandbox has a known, unresolved environment
  flake (see #63 below) that can fail `auth.setup.ts` regardless of your change; retrying wastes
  20–30 min and rarely helps. If the run fails or can't start:
  1. Confirm your specs compile / are discovered: `pnpm exec playwright test --list`.
  2. Comment on the issue that e2e **could not be verified in the sandbox and a human must run
     it** — name the specs and paste the failure.
  3. Still commit and close, provided `pnpm verify` is green and the specs list cleanly.

## Known issues

- **Slow 9P bind mount (Windows→Linux).** Cold Turbopack compiles take 10–30 s per route; prefer
  targeted commands. The e2e auth setup already budgets 300 s for this.
- **Stale `.next` after a `next.config.ts` change** makes API routes 404 while pages still render.
  Fix: `rm -rf .next` and rerun. A fresh worktree has none, so this only bites after config edits.
- **`.next` corruption from a killed/SIGKILL'd `next dev`** (issues #58/#60) looks like a network
  bug: `auth.setup.ts` ECONNRESET, "Network error" on sign-in, or syntax errors in
  `.next/dev/types/routes.d.ts`. Fix: `rm -rf .next && rm -f langtutor-e2e.db*` before the next
  run. `playwright.config.ts` now uses `gracefulShutdown: SIGTERM` (not SIGKILL) +
  `reuseExistingServer: false` in-sandbox to reduce this class of flake.
- **`data/wordnet.json` / `data/words-cefr.json` are gitignored**, copied into the worktree by a
  host hook. If missing, lexicon API routes crash the dev server (ECONNRESET) — note it, don't
  debug it as code.
- **(issue #57, RESOLVED) Turbopack "couldn't find the Next.js package" boot failure.** The image
  pins `LANGTUTOR_TURBOPACK_ROOT=/home/agent` and widens `next.config.ts` `turbopack.root`. If you
  still see this, the image is stale — comment on the issue and stop.
- **(issue #63, UNRESOLVED) `auth.setup.ts` warmup `GET /api/lexicon/define` can ECONNRESET**,
  failing every spec in the run regardless of your change (reproduced on a clean `main` stash;
  curl replays of the same sequence succeed, so it's Playwright's concurrent load on a cold dev
  server, not the lexicon route). Per the E2E policy above: run once, don't retry, hand off to a
  human.
- **(issue #108) ESLint `react-hooks/rules-of-hooks` false-positive on Playwright fixture `use`**
  in `tests/e2e/fixtures.ts` — calling the fixture setup's second callback (conventionally named
  `use`) is misread as React's `use` hook. Rename the parameter (e.g. `provide`) — Playwright
  only requires invoking that callback; the identifier name is not part of the API contract.
- **(issue #108) `pnpm format:check` fails on clean HEAD** for a fixed set of already-committed
  files (e2e specs, deck UI, AGENTS.md, e2e-playwright reference.md). Prettier `--write` on those
  paths is required before `pnpm verify` can pass; include the format-only touch in the same
  commit when blocked. `.claude/skills/**/SKILL.md` is in `.prettierignore` because Prettier
  Markdown rewrites `llm/*` globs to `llm/_`.
- **(issue #108) Bracket-trick process cleanup kills the agent (exit 143).** The agent
  `--force` prompt includes this contract verbatim, so a full-cmdline pattern match still
  hits the agent process. Prefer leaving hung Playwright alone (e2e policy: run once, don't
  retry, hand off) or kill by numeric PID only. See Hard bans above.
- (Add new, verified findings here — with the run/issue number.)

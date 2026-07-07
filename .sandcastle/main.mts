import {
  run,
  claudeCode,
  cursor,
  copilot,
  type AgentProvider,
  type IterationUsage,
  type RunResult,
} from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import dotenv from "dotenv";
import { mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

// Usage:
//   pnpm sandcastle [--agent claude|cursor|copilot]
//                                  loop through ALL open "sandcastle"-labelled issues
//                                  in DEPENDENCY ORDER (topological sort of each issue's
//                                  "## Blocked by" section), one at a time, merge-to-head.
//   pnpm sandcastle:issue 2      — target a single issue
//   pnpm sandcastle:issue 2,3,5  — target a comma-separated list of issues (parallel, no
//                                  dependency ordering — use only for independent issues)

// Ensure the persistent pnpm store directory exists before docker() validates it.
mkdirSync(".sandcastle/.pnpm-store", { recursive: true });

dotenv.config({ path: join(process.cwd(), ".sandcastle", ".env") });

const SANDBOX = docker({
  imageName: "sandcastle:lang-tutor",
  // Persist the pnpm content-addressable store on the host across runs.
  // First run populates it (slow); every subsequent run uses --prefer-offline
  // and finishes in seconds without re-downloading packages.
  mounts: [
    {
      hostPath: ".sandcastle/.pnpm-store",
      sandboxPath: "/home/agent/.local/share/pnpm/store",
    },
    // NOTE: no mount for Playwright browsers. Chromium is baked into the image
    // at /ms-playwright (PLAYWRIGHT_BROWSERS_PATH) — downloading/extracting it
    // through the 9P Windows bind mount times out and is slow to launch from.
  ],
});

const DEFAULT_MODELS = {
  cursor: "composer-2.5",
  copilot: "claude-sonnet-5",
  claude: "claude-sonnet-5",
} as const;

function readEnvModel(key: string, fallback: string) {
  const raw = process.env[key];
  if (!raw) return fallback;

  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // Be tolerant of users writing quoted values in .env files.
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted || fallback;
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// Token-usage wrappers.
//
// Sandcastle prints "Context window: Nk" per iteration whenever the provider
// surfaces an IterationUsage — but out of the box only Claude Code (session
// JSONL parse) and Codex (stream event) do. Cursor and Copilot never populate
// usage, so their runs show nothing. Both CLIs *do* expose the numbers:
//
// - Cursor CLI: the terminal `result` stream-json event carries an
//   (undocumented) `usage` object — verified against cursor-agent
//   2026.07.01: {inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens},
//   where inputTokens is INCLUSIVE of the cache read/write counts.
// - Copilot CLI: stdout has no input-token data, but the session log
//   ~/.copilot/session-state/<id>/events.jsonl ends with a compact-JSON
//   `session.shutdown` event carrying tokenDetails + currentTokens (the live
//   context-window size). We surface that line onto stdout after the CLI
//   exits and parse it here. Verified against Copilot CLI 1.0.68.
//
// Each wrapper extends parseStreamLine to emit a `usage` event; sandcastle's
// existing machinery does the rest (per-iteration display + RunResult).
// ---------------------------------------------------------------------------

type StreamEvents = ReturnType<AgentProvider["parseStreamLine"]>;

function withCursorUsage(provider: AgentProvider): AgentProvider {
  return {
    ...provider,
    parseStreamLine(line: string): StreamEvents {
      const events = [...provider.parseStreamLine(line)];
      if (!line.startsWith("{")) return events;
      try {
        const obj = JSON.parse(line) as {
          type?: string;
          usage?: {
            inputTokens?: number;
            outputTokens?: number;
            cacheReadTokens?: number;
            cacheWriteTokens?: number;
          };
        };
        if (obj.type === "result" && typeof obj.usage?.inputTokens === "number") {
          const u = obj.usage;
          const cacheRead = u.cacheReadTokens ?? 0;
          const cacheWrite = u.cacheWriteTokens ?? 0;
          const usage: IterationUsage = {
            // Cursor's inputTokens includes the cached portions; split them out
            // so input + cacheCreation + cacheRead === the real context size.
            inputTokens: Math.max(0, u.inputTokens - cacheRead - cacheWrite),
            cacheCreationInputTokens: cacheWrite,
            cacheReadInputTokens: cacheRead,
            outputTokens: u.outputTokens ?? 0,
          };
          events.push({ type: "usage", usage });
        }
      } catch {
        // non-JSON line — ignore
      }
      return events;
    },
  };
}

function withCopilotUsage(provider: AgentProvider): AgentProvider {
  return {
    ...provider,
    buildPrintCommand(options) {
      const base = provider.buildPrintCommand(options);
      // After copilot exits, echo the newest session's `session.shutdown` line
      // (the only place Copilot CLI records input-token counts) to stdout so
      // parseStreamLine below can pick it up. Preserve copilot's exit code.
      const command =
        `${base.command}; __rc=$?; ` +
        `__f=$(ls -t "$HOME"/.copilot/session-state/*/events.jsonl 2>/dev/null | head -n 1); ` +
        `if [ -n "$__f" ]; then grep '"type":"session.shutdown"' "$__f" | tail -n 1; fi; ` +
        `exit $__rc`;
      return { ...base, command };
    },
    parseStreamLine(line: string): StreamEvents {
      const events = [...provider.parseStreamLine(line)];
      if (!line.startsWith("{")) return events;
      try {
        const obj = JSON.parse(line) as {
          type?: string;
          data?: {
            currentTokens?: number;
            tokenDetails?: Record<string, { tokenCount?: number }>;
          };
        };
        if (obj.type === "session.shutdown" && obj.data) {
          const td = obj.data.tokenDetails;
          const usage: IterationUsage = {
            // currentTokens is the live context-window size at shutdown —
            // the copilot analog of Claude's last-message input total. The
            // tokenDetails input/cache counts aggregate across ALL turns, so
            // summing them would wildly overstate the context window.
            inputTokens: obj.data.currentTokens ?? td?.input?.tokenCount ?? 0,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
            outputTokens: td?.output?.tokenCount ?? 0,
          };
          events.push({ type: "usage", usage });
        }
      } catch {
        // non-JSON line — ignore
      }
      return events;
    },
  };
}

function getAgent() {
  const agentFlag = process.argv.indexOf("--agent");
  const agentStr =
    agentFlag !== -1 ? process.argv[agentFlag + 1] : (process.env.SANDCASTLE_AGENT ?? "claude");

  switch (agentStr) {
    case "cursor": {
      const model = readEnvModel("SANDCASTLE_CURSOR_MODEL", DEFAULT_MODELS.cursor);
      return withCursorUsage(cursor(model));
    }
    case "copilot": {
      const model = readEnvModel("SANDCASTLE_COPILOT_MODEL", DEFAULT_MODELS.copilot);
      return withCopilotUsage(copilot(model));
    }
    case "claude":
    default: {
      const model = readEnvModel("SANDCASTLE_CLAUDE_MODEL", DEFAULT_MODELS.claude);
      return claudeCode(model);
    }
  }
}

const AGENT = getAgent();

function ensureWindowsGitLongPaths() {
  if (process.platform !== "win32") return;
  try {
    // `git worktree remove` can fail on Windows when long paths are disabled.
    execSync("git config core.longpaths true", { stdio: "ignore" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: failed to set git core.longpaths=true (${message})`);
  }
}

ensureWindowsGitLongPaths();

const HOOKS = {
  host: {
    // Host hooks run SEQUENTIALLY (unlike sandbox onSandboxReady hooks) with
    // cwd = the worktree, via cmd.exe on Windows.
    onWorktreeReady: [
      // Stub .env.local so tsc/build don't require real Mac services in the sandbox.
      { command: "copy .env.example .env.local" },
      // Copy the gitignored lexicon datasets into the worktree. `git worktree add`
      // only materialises tracked files, so without these the dev server's WordNet
      // load crashes (ECONNRESET) during the e2e auth warm-up. Guard with `if exist`
      // so a missing host file degrades to "e2e lexicon routes unavailable" instead
      // of failing the run.
      {
        command: `if exist "${join(process.cwd(), "data", "wordnet.json")}" copy /Y "${join(process.cwd(), "data", "wordnet.json")}" data\\wordnet.json`,
      },
      {
        command: `if exist "${join(process.cwd(), "data", "words-cefr.json")}" copy /Y "${join(process.cwd(), "data", "words-cefr.json")}" data\\words-cefr.json`,
      },
    ],
  },
  sandbox: {
    // pnpm install as a safety net for platform-specific binaries.
    // Note: we do NOT copyToWorktree node_modules — pnpm uses symlinks to a
    // content-addressable store that would break when copied into the container.
    // First run populates the mounted store (slow). Subsequent runs hit the
    // cache and finish in seconds. 300s covers a cold first run.
    onSandboxReady: [
      {
        // ONE chained hook, not two: sandcastle runs onSandboxReady hooks with
        // concurrency "unbounded", so separate hooks race each other. A separate
        // `playwright install` hook deadlocks against the concurrent `pnpm install`
        // (pnpm exec blocks on the in-progress install) and times out. Chaining
        // with && guarantees ordering.
        //
        // pnpm install:
        // --store-dir   : use our bind-mounted Windows host cache (avoids re-downloading).
        // --virtual-store-dir : put the .pnpm virtual store inside the container's native Linux
        //   filesystem (not the Windows bind-mounted workspace). Extracting 500MB of packages
        //   through Docker's 9P Windows→Linux layer is very slow; the native layer is fast.
        //   node_modules/<pkg> symlinks then use absolute container paths, which work fine.
        //
        // playwright install:
        // Chromium 1.61.0 is baked into the image at PLAYWRIGHT_BROWSERS_PATH
        // (/ms-playwright, native FS) — this is a ~2s no-op when the repo's
        // Playwright version matches the image; if the repo bumps Playwright it
        // downloads the new binary to the native path (rebuild the image to
        // make that permanent). Never use --with-deps here (needs sudo).
        command:
          "pnpm install --prefer-offline --frozen-lockfile" +
          " --store-dir /home/agent/.local/share/pnpm/store" +
          " --virtual-store-dir /home/agent/.pnpm-virtual-store" +
          " && pnpm exec playwright install chromium",
        timeoutMs: 600_000,
      },
    ],
  },
};

const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** Print a per-iteration token-usage summary to the console after a run. */
function printTokenUsage(label: string, iterations: RunResult["iterations"]) {
  for (const [i, it] of iterations.entries()) {
    const u = it.usage;
    if (!u) {
      console.log(`[${label}] iteration ${i + 1}: token usage unavailable`);
      continue;
    }
    const context = u.inputTokens + u.cacheCreationInputTokens + u.cacheReadInputTokens;
    console.log(
      `[${label}] iteration ${i + 1}: context ${fmtTokens(context)} tokens` +
        ` (input ${fmtTokens(u.inputTokens)}, cache write ${fmtTokens(u.cacheCreationInputTokens)},` +
        ` cache read ${fmtTokens(u.cacheReadInputTokens)}), output ${fmtTokens(u.outputTokens)}`,
    );
  }
}

// Verbose container logging: append every raw stdout line the agent emits to
// the run's log file (in addition to the parsed human-readable log). Includes
// stream events the parser drops — invaluable for post-mortems. Set
// SANDCASTLE_VERBOSE=0 to disable.
const VERBOSE_LOGS = process.env.SANDCASTLE_VERBOSE !== "0";

/** Run one issue in its own sandbox. In loop mode we merge-to-head so the next
 *  issue's worktree (branched from HEAD) sees the prior issue's committed work —
 *  this is what makes the dependency ordering actually compose. */
async function runIssue(
  n: string,
  branchStrategy: { type: "branch"; branch: string } | { type: "merge-to-head" },
) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const result = await run({
    name: `issue-${n}`,
    sandbox: SANDBOX,
    agent: AGENT,
    promptFile: ".sandcastle/prompt-issue.md",
    promptArgs: { ISSUE_NUMBER: n },
    branchStrategy,
    maxIterations: 5,
    hooks: HOOKS,
    logging: {
      type: "file",
      path: join(process.cwd(), ".sandcastle", "logs", `issue-${n}-${AGENT.name}-${stamp}.log`),
      verbose: VERBOSE_LOGS,
    },
  });
  printTokenUsage(`issue-${n}`, result.iterations);
  return result;
}

// ---------------------------------------------------------------------------
// CLI: --issue 2  OR  --issue 2,3,5  (targeted, parallel — no dependency ordering)
// ---------------------------------------------------------------------------
const issueFlag = process.argv.indexOf("--issue");
const issueArg = issueFlag !== -1 ? process.argv[issueFlag + 1] : undefined;

if (issueArg) {
  const numbers = issueArg.split(",").map((s) => s.trim());

  console.log(`Running issue(s) in sandbox (parallel): ${numbers.map((n) => `#${n}`).join(", ")}`);

  const results = await Promise.allSettled(
    numbers.map((n) => runIssue(n, { type: "branch", branch: `agent/issue-${n}` })),
  );

  let failed = 0;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const n = numbers[i];
    if (result.status === "fulfilled") {
      const { commits, branch } = result.value;
      console.log(`✓  #${n} — ${commits.length} commit(s) on ${branch}`);
    } else {
      console.error(`✗  #${n} — ${(result.reason as Error).message}`);
      failed++;
    }
  }
  process.exit(failed > 0 ? 1 : 0);
} else {
  // -------------------------------------------------------------------------
  // Loop mode — deterministic, dependency-ordered.
  //
  // 1. Fetch all OPEN "sandcastle"-labelled issues (gh --label is case-insensitive,
  //    so this matches the repo's lowercase `sandcastle` label).
  // 2. Parse each issue's "## Blocked by" section for `#<n>` references, keeping
  //    only blockers that are themselves in the open set (already-closed blockers
  //    are satisfied). The "## Parent" reference (#PRD) is in a different section
  //    and is intentionally NOT treated as a blocker.
  // 3. Topologically sort (Kahn; ties broken by ascending issue number).
  // 4. Run sequentially, merge-to-head between each, so dependents see their
  //    blockers' committed work. Stop on the first failure — a dependent can't
  //    succeed once its blocker has failed.
  // -------------------------------------------------------------------------
  type Issue = { number: number; title: string; body: string | null };

  const raw = execSync(
    "gh issue list --state open --label sandcastle --limit 100 --json number,title,body",
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  const issues: Issue[] = JSON.parse(raw);

  if (issues.length === 0) {
    console.log('No open "sandcastle"-labelled issues. Nothing to do.');
    process.exit(0);
  }

  const openSet = new Set(issues.map((i) => i.number));

  /** Extract blocker issue numbers from the "## Blocked by" section only. */
  function parseBlockers(body: string | null): number[] {
    if (!body) return [];
    const section = body.match(/##\s*Blocked by([\s\S]*?)(?:\n##\s|$)/i);
    if (!section) return [];
    const refs = [...section[1].matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
    return [...new Set(refs)].filter((d) => openSet.has(d));
  }

  const deps = new Map<number, Set<number>>();
  for (const i of issues) deps.set(i.number, new Set(parseBlockers(i.body)));

  // Kahn's algorithm — process all currently-unblocked issues each pass.
  const remaining = new Set(openSet);
  const ordered: number[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((n) => [...deps.get(n)!].every((d) => !remaining.has(d)))
      .sort((a, b) => a - b);
    if (ready.length === 0) {
      throw new Error(
        `Dependency cycle (or missing blocker) among issues: ${[...remaining].join(", ")}`,
      );
    }
    ordered.push(...ready);
    for (const n of ready) remaining.delete(n);
  }

  console.log(`Dependency-ordered plan (${ordered.length} issue(s)):`);
  for (let i = 0; i < ordered.length; i++) {
    const n = ordered[i];
    const blockers = [...deps.get(n)!];
    const title = issues.find((x) => x.number === n)?.title ?? "";
    console.log(
      `  ${i + 1}. #${n} ${blockers.length ? `(after ${blockers.map((b) => `#${b}`).join(", ")})` : "(no blockers)"} — ${title}`,
    );
  }

  let failed = 0;
  for (let i = 0; i < ordered.length; i++) {
    const n = ordered[i];
    console.log(`\n=== #${n} (${i + 1}/${ordered.length}) ===`);
    try {
      const { commits, branch } = await runIssue(String(n), { type: "merge-to-head" });
      console.log(`✓  #${n} — ${commits.length} commit(s) merged via ${branch}`);
    } catch (err) {
      console.error(`✗  #${n} — ${(err as Error).message}`);
      console.error(
        "Stopping: downstream issues depend on this one. Fix and re-run `pnpm sandcastle`.",
      );
      failed++;
      break;
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

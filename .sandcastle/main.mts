import { run, claudeCode, cursor, copilot } from "@ai-hero/sandcastle";
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
  ],
});

function getAgent() {
  const agentFlag = process.argv.indexOf("--agent");
  const agentStr =
    agentFlag !== -1 ? process.argv[agentFlag + 1] : (process.env.SANDCASTLE_AGENT ?? "claude");

  switch (agentStr) {
    case "cursor":
      return cursor("composer-2");
    case "copilot":
      return copilot("claude-sonnet-4.5");
    case "claude":
    default:
      return claudeCode("claude-sonnet-4-6");
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
    // Stub .env.local so tsc/build don't require real Mac services in the sandbox.
    // Use "copy" (cmd.exe) since host hooks run on Windows, not in the container.
    onWorktreeReady: [{ command: "copy .env.example .env.local" }],
  },
  sandbox: {
    // pnpm install as a safety net for platform-specific binaries.
    // Note: we do NOT copyToWorktree node_modules — pnpm uses symlinks to a
    // content-addressable store that would break when copied into the container.
    // First run populates the mounted store (slow). Subsequent runs hit the
    // cache and finish in seconds. 300s covers a cold first run.
    onSandboxReady: [
      {
        // --store-dir   : use our bind-mounted Windows host cache (avoids re-downloading).
        // --virtual-store-dir : put the .pnpm virtual store inside the container's native Linux
        //   filesystem (not the Windows bind-mounted workspace). Extracting 500MB of packages
        //   through Docker's 9P Windows→Linux layer is very slow; the native layer is fast.
        //   node_modules/<pkg> symlinks then use absolute container paths, which work fine.
        command:
          "pnpm install --prefer-offline --frozen-lockfile" +
          " --store-dir /home/agent/.local/share/pnpm/store" +
          " --virtual-store-dir /home/agent/.pnpm-virtual-store",
        timeoutMs: 600_000,
      },
    ],
  },
};

/** Run one issue in its own sandbox. In loop mode we merge-to-head so the next
 *  issue's worktree (branched from HEAD) sees the prior issue's committed work —
 *  this is what makes the dependency ordering actually compose. */
async function runIssue(
  n: string,
  branchStrategy: { type: "branch"; branch: string } | { type: "merge-to-head" },
) {
  return run({
    name: `issue-${n}`,
    sandbox: SANDBOX,
    agent: AGENT,
    promptFile: ".sandcastle/prompt-issue.md",
    promptArgs: { ISSUE_NUMBER: n },
    branchStrategy,
    maxIterations: 5,
    hooks: HOOKS,
  });
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

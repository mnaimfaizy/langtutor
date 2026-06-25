import { run, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { mkdirSync } from "node:fs";

// Usage:
//   pnpm sandcastle              — loop through all open "Sandcastle"-labelled issues
//   pnpm sandcastle:issue 2      — target a single issue
//   pnpm sandcastle:issue 2,3,5  — target a comma-separated list of issues

// Ensure the persistent pnpm store directory exists before docker() validates it.
mkdirSync(".sandcastle/.pnpm-store", { recursive: true });

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
const AGENT = claudeCode("claude-sonnet-4-6");

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

// ---------------------------------------------------------------------------
// CLI: --issue 2  OR  --issue 2,3,5
// ---------------------------------------------------------------------------
const issueFlag = process.argv.indexOf("--issue");
const issueArg = issueFlag !== -1 ? process.argv[issueFlag + 1] : undefined;

if (issueArg) {
  // Targeted mode — one run per issue, each on its own branch, in parallel.
  const numbers = issueArg.split(",").map((n) => n.trim());

  console.log(`Running issue(s) in sandbox: ${numbers.map((n) => `#${n}`).join(", ")}`);

  const results = await Promise.allSettled(
    numbers.map((n) =>
      run({
        name: `issue-${n}`,
        sandbox: SANDBOX,
        agent: AGENT,
        promptFile: ".sandcastle/prompt-issue.md",
        promptArgs: { ISSUE_NUMBER: n },
        branchStrategy: { type: "branch", branch: `agent/issue-${n}` },
        maxIterations: 5,
        hooks: HOOKS,
      }),
    ),
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
  // Default loop mode — agent picks "Sandcastle"-labelled issues one at a time.
  await run({
    name: "worker",
    sandbox: SANDBOX,
    agent: AGENT,
    promptFile: ".sandcastle/prompt.md",
    maxIterations: 10,
    branchStrategy: { type: "merge-to-head" },
    hooks: HOOKS,
  });
}

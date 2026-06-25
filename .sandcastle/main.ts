import { run, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { execSync } from "node:child_process";

const REPO = "mnaimfaizy/langtutor";

// Image built by `pnpm sandcastle:build` from .sandcastle/Dockerfile
const SANDBOX = docker({ imageName: "sandcastle:local" });

interface GhIssue {
  number: number;
  title: string;
  body: string;
}

function fetchIssue(number: number): GhIssue {
  const raw = execSync(
    `gh issue view ${number} --repo ${REPO} --json number,title,body`,
  ).toString();
  return JSON.parse(raw) as GhIssue;
}

function fetchOpenIssues(): GhIssue[] {
  const raw = execSync(
    `gh issue list --repo ${REPO} --state open --json number,title,body`,
  ).toString();
  return JSON.parse(raw) as GhIssue[];
}

function runIssue(issue: GhIssue) {
  return run({
    agent: claudeCode("claude-sonnet-4-6"),
    sandbox: SANDBOX,
    promptFile: ".sandcastle/prompt.md",
    promptArgs: {
      ISSUE_NUMBER: String(issue.number),
      ISSUE_TITLE: issue.title,
      ISSUE_BODY: issue.body,
    },
    // Each issue gets its own branch; merge it back once the agent is done.
    branchStrategy: { type: "branch", branch: `agent/issue-${issue.number}` },
    name: `issue-${issue.number}`,
    maxIterations: 5,
    hooks: {
      // Copy the env stub so tsc/pnpm don't require real Mac services.
      host: {
        onWorktreeReady: [{ command: "cp .env.example .env.local" }],
      },
      // Install deps inside the sandbox after the container mounts the worktree.
      sandbox: {
        onSandboxReady: [{ command: "pnpm install --frozen-lockfile" }],
      },
    },
  });
}

// ---------------------------------------------------------------------------
// CLI parsing
//
//   pnpm sandcastle              → all open issues in parallel
//   pnpm sandcastle:issue 2      → single issue
//   pnpm sandcastle:issue 2,3,5  → comma-separated list
// ---------------------------------------------------------------------------
const issueFlag = process.argv.indexOf("--issue");
const issueArg = issueFlag !== -1 ? process.argv[issueFlag + 1] : undefined;

const issues: GhIssue[] = issueArg
  ? issueArg.split(",").map((n) => fetchIssue(Number(n.trim())))
  : fetchOpenIssues();

if (issues.length === 0) {
  console.log("No open issues found.");
  process.exit(0);
}

console.log(
  `Running ${issues.length} issue(s) in parallel: ${issues.map((i) => `#${i.number}`).join(", ")}`,
);

const results = await Promise.allSettled(issues.map(runIssue));

let failed = 0;
for (let i = 0; i < results.length; i++) {
  const result = results[i];
  const issue = issues[i];
  if (result.status === "fulfilled") {
    const { commits, branch } = result.value;
    console.log(`✓  #${issue.number} — ${commits.length} commit(s) on ${branch}`);
  } else {
    console.error(`✗  #${issue.number} — ${(result.reason as Error).message}`);
    failed++;
  }
}

process.exit(failed > 0 ? 1 : 0);

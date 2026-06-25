FROM node:22-alpine

# pnpm via corepack (matches host toolchain)
RUN corepack enable && corepack prepare pnpm@latest --activate

# git is required by Sandcastle for worktree operations; curl for health-checks
RUN apk add --no-cache git ca-certificates curl

# Claude Code CLI — the agent that runs inside this sandbox
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

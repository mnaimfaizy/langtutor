FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

# Playwright Chromium OS dependencies (headless). Installed at build time as root —
# the agent user has no sudo, so `playwright install --with-deps` must NEVER be run
# in the sandbox (see .sandcastle/ENVIRONMENT.md).
RUN apt-get update && apt-get install -y \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libglib2.0-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libx11-6 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# Bake the Chromium browser binary into the image on the container's NATIVE
# filesystem. Downloading/extracting ~150 MB through the Windows 9P bind mount
# times out (>5 min observed) — the same lesson as the pnpm virtual store.
# The version MUST match the repo's @playwright/test (pnpm-lock.yaml); the
# onSandboxReady hook `pnpm exec playwright install chromium` is a fast no-op
# when they match and re-downloads to this native path if the repo bumps it.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx -y playwright@1.61.0 install chromium && chmod -R a+rX /ms-playwright

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# pnpm via corepack (must run as root before switching user)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Tell pnpm to use a fixed store path that matches our host bind-mount.
# pnpm 11 changed the default to {workspace}/.pnpm-store; this overrides it
# back to the home-relative path so the mount at /home/agent/.local/share/pnpm/store
# is always the effective store regardless of which directory pnpm runs from.
ENV PNPM_STORE_DIR=/home/agent/.local/share/pnpm/store

# Build-args for UID/GID alignment: sandcastle docker build-image
# defaults these to the host user's UID/GID so image-built files
# and bind-mounted files share an owner without runtime chown.
ARG AGENT_UID=1000
ARG AGENT_GID=1000

# Rename the base image's "node" user to "agent" and align UID/GID.
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node

# Install the supported agent CLIs
# Copilot installs globally before we drop to the agent user; Cursor and Claude
# install into the agent home directory and share the same PATH entry.
RUN npm install -g @github/copilot
USER ${AGENT_UID}:${AGENT_GID}

# Install Claude and Cursor CLIs
RUN curl -fsSL https://claude.ai/install.sh | bash
RUN curl https://cursor.com/install -fsS | bash

# Add CLI paths
ENV PATH="/home/agent/.local/bin:$PATH"

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]

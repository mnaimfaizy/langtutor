FROM node:22-alpine

# pnpm via corepack (matches local toolchain)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Chromium + deps for Playwright e2e (optional — skip with SKIP_E2E=1)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Install dependencies (cached layer — only re-runs when lockfile changes)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Stub .env.local so tsc/build don't require real Mac services.
# Mac endpoints remain unreachable; tests use MockLLMClient + fake-indexeddb.
RUN cp .env.example .env.local

# Smoke-check: the CI gate must pass on a clean checkout.
RUN pnpm verify

# Default: run the full CI gate.
# Override with: docker run <image> pnpm test:e2e
CMD ["pnpm", "verify"]

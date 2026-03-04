# ──────────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ──────────────────────────────────────────────────────────────
FROM oven/bun:1.3.10-alpine@sha256:32f1fcccb1523960b254c4f80973bee1a910d60be000a45c20c9129a1efcffee AS deps

WORKDIR /app

# Copy only the files needed for dependency resolution
COPY package.json bun.lock ./

# Install dependencies
# --frozen-lockfile ensures reproducible builds
# --ignore-scripts skips lifecycle scripts (lefthook, etc.) not needed in container
RUN bun install --frozen-lockfile --ignore-scripts

# ──────────────────────────────────────────────────────────────
# Stage 2: Build the application
# ──────────────────────────────────────────────────────────────
FROM oven/bun:1.3.10-alpine@sha256:32f1fcccb1523960b254c4f80973bee1a910d60be000a45c20c9129a1efcffee AS builder

WORKDIR /app

# Build-time args for NEXT_PUBLIC_* vars (inlined into JS bundle by Next.js)
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_APP_URL

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set Next.js telemetry to disabled during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application (standalone output)
RUN bun run build

# ──────────────────────────────────────────────────────────────
# Stage 3: Production runtime (distroless — no shell, hardened)
# ──────────────────────────────────────────────────────────────
FROM oven/bun:1.3.10-distroless@sha256:5c96bec5076bd16b8216d18cadb17b626a0e5158cfcf110818642e464e122740 AS runner

WORKDIR /app

# Distroless runs as non-root (uid 1000) by default — no need to create users
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Copy the standalone server output
COPY --from=builder /app/.next/standalone ./

# Copy static assets (not included in standalone)
COPY --from=builder /app/.next/static ./.next/static

# Copy public assets
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["server.js"]

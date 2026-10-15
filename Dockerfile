# ──────────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ──────────────────────────────────────────────────────────────
FROM oven/bun:1.4.3-alpine AS deps

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
FROM oven/bun:1.4.3-alpine AS builder

WORKDIR /app

# Build-time args for NEXT_PUBLIC_* vars (inlined into JS bundle by Next.js)
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_CONVEX_SITE_URL

# Convex deploy key for CI/CD authentication (generate in Convex dashboard → Settings → Deploy Keys)
ARG CONVEX_DEPLOY_KEY

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
FROM oven/bun:1.4.3-distroless AS runner

WORKDIR /app

# Distroless runs as non-root (uid 1000) by default — no need to create users
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Copy the standalone server output
COPY --from=builder /app/.next/standalone ./

# Copy static assets and public files (neither is included in standalone)
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["server.js"]

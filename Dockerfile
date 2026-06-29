# ──────────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ──────────────────────────────────────────────────────────────
FROM oven/bun:1.3.14-alpine@sha256:efc5e42c7bedc1661ab0b7272c74c3ebf794f054297f530a62055f2d1a0eb662 AS deps

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile --ignore-scripts

# ──────────────────────────────────────────────────────────────
# Stage 2: Build the application
# ──────────────────────────────────────────────────────────────
FROM oven/bun:1.3.14-alpine@sha256:efc5e42c7bedc1661ab0b7272c74c3ebf794f054297f530a62055f2d1a0eb662 AS builder

WORKDIR /app

ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_CONVEX_SITE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Web-only build — Convex deploy runs in CI / docker-compose profile, not here.
RUN bun run dev:build

# ──────────────────────────────────────────────────────────────
# Stage 3: Production runtime (distroless — no shell, hardened)
# ──────────────────────────────────────────────────────────────
FROM oven/bun:1.3.14-distroless@sha256:33f77b7272271632bd29dfb066d60a75510b827ee8c641f1905077bbdb18d014 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./

COPY --from=builder /app/.next/static ./.next/static


EXPOSE 3000

CMD ["server.js"]

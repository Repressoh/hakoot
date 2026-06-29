# hakoot

## What this codebase does

Real-time learning platform (Kahoot-style): hosts build games with theory
steps and quizzes, run live sessions, and players join via invite codes.
Stack: Next.js 16 App Router (RSC), Convex backend, Convex Auth (Google +
password/magic link), next-intl (EN/IT), Resend email, Cloudflare Turnstile
on sign-in/join.

## Auth shape

- **Hosts** — Convex Auth via `@convex-dev/auth`: `getAuthUserId(ctx)` guards
  mutations/queries in `convex/games.ts`, `convex/sessions.ts` (host ops),
  `convex/account.ts`. Dashboard routes assume an authenticated viewer.
- **Players** — unauthenticated join flow: `sessions.join` /
  `sessions.joinByCode` issue a `participantToken` stored in
  `localStorage`; subsequent player mutations pass `participantToken` and
  are validated with `by_token` index lookups (not host auth).
- **HTTP** — `convex/http.ts` exposes Convex Auth routes plus public
  `POST /verify-turnstile` (Cloudflare siteverify proxy).
- **Account** — `convex/account.ts` actions (`changeEmail`, `changePassword`,
  `deleteUserData`) require `getAuthUserId` and password verification via
  `retrieveAccount` / `modifyAccountCredentials`.

## Threat model

Primary assets: host accounts, game content, live session integrity, and
participant PII (names/emails). Attackers would aim to hijack host sessions,
join sessions without Turnstile, guess/brute invite codes, escalate from
player token to host privileges, or abuse email/account mutations. Player
tokens are bearer credentials — leakage from `localStorage` or logs is high
impact for that session.

## Project-specific patterns to flag

- **Bearer `participantToken`** — any host-only Convex function that accepts
  only `participantToken` without session-state checks (e.g. answering after
  reveal, cross-session token reuse).
- **`/verify-turnstile` HTTP action** — missing origin allowlist, secret
  handling, or client bypass of Turnstile before `joinByCode` / password
  sign-in.
- **Invite flows** — `INVITE_HMAC_SECRET` usage for signed invite links;
  weak/missing HMAC verification or predictable invite codes.
- **Convex Auth callbacks** — `createOrUpdateUser` account linking; duplicate
  or cross-email identity merge bugs.
- **`rehype-raw` in Markdown** — user-authored theory content rendered with
  raw HTML; XSS if sanitization is absent upstream.

## Known false-positives

- `convex/_generated/**` — Convex codegen; not hand-maintained security surface.
- `.agents/skills/**` — agent skill docs, not production runtime.
- `messages/*.json` — i18n strings only.
- Public player join endpoints are **intentionally** unauthenticated; risk is
  in token handling and rate limits, not missing `getAuthUserId`.
- `experimental.optimizeCss` + `beasties` import in `next.config.ts` is a
  build-time CSS optimization dependency, not a runtime attack surface.

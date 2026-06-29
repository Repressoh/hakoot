# deepsec

Security harness for [hakoot](https://github.com/Repressoh/hakoot), powered by
[deepsec](https://github.com/vercel-labs/deepsec). Project context and custom
matchers are checked in; generated scan output is gitignored.

Configured project: **hakoot** (target: `..`).

## Setup

```bash
cd .deepsec
bun install
cp .env.example .env.local   # optional — see below
```

**AI credentials** (only needed for `process`, `revalidate`, `triage`):

This workspace is configured for the **Codex agent** with **`evomap-gpt-5.5`**
via [Evomap](https://api.evomap.ai) (`OPENAI_BASE_URL` + `OPENAI_API_KEY` in
`.env.local`). Scripts pass `--agent codex --model evomap-gpt-5.5`.

Pick one auth path in `.env.local`:

- **`OPENAI_API_KEY` + `OPENAI_BASE_URL`** — OpenAI-compatible API (default:
  `https://api.openai.com/v1`; custom providers like Evomap work too)
- **`AI_GATEWAY_API_KEY`** — [Vercel AI Gateway](https://vercel.com/ai-gateway)
  (covers Codex, Claude, and Pi)
- **`ANTHROPIC_AUTH_TOKEN`** — use with `--agent claude` instead
- Logged-in **`codex`** / **`claude`** CLI on this machine (auto-detected).
  Run `bun run codex-login` and complete the device flow at
  https://auth.openai.com/codex/device

**Cursor agent:** deepsec has no Cursor Cloud Agent backend. Cursor's API
is separate from deepsec; use Codex + `gpt-5.5` above for the same model
through OpenAI (or a gateway).

`scan` is free (regex only) and needs no API key.

## Commands

From the repo root:

```bash
bun run deepsec:scan
bun run deepsec:status
bun run deepsec:process      # AI stage — costs money
bun run deepsec:revalidate   # optional FP reduction
bun run deepsec:export
```

Or from `.deepsec/`:

```bash
bun run scan
bun run process --concurrency 5
bun run export -- --format md-dir --out ./findings
```

`--project-id` is auto-resolved while only `hakoot` is registered.

## Layout

```
deepsec.config.ts        Project list
data/hakoot/
  INFO.md                Repo context (checked in)
  files/                 Per-file scan records (gitignored)
  runs/                  Run metadata (gitignored)
  reports/               Reports (gitignored)
AGENTS.md                Pointer for coding agents
.env.local               Tokens (gitignored)
```

## Docs

After `bun install`:

- Skill: `node_modules/deepsec/SKILL.md`
- Docs: `node_modules/deepsec/dist/docs/`

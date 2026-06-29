# Agent setup

This is the deepsec scanning workspace for **hakoot**. Project context lives
in `data/hakoot/INFO.md` (already filled in).

## Common tasks

- **Run a scan**: `bun run scan` (free, regex matchers only).
- **AI investigation**: `bun run process` — uses **Codex + gpt-5.5** by
  default. Set `OPENAI_API_KEY` (or `AI_GATEWAY_API_KEY`) in `.env.local`,
  or use a logged-in `codex` CLI. deepsec does not call Cursor's agent API.
- **Write a custom matcher** (after a confirmed true positive): read
  `node_modules/deepsec/dist/docs/writing-matchers.md`.
- **Add another project**: `bunx deepsec init-project ../other-repo` from
  this directory.

## Reference

- Skill: `node_modules/deepsec/SKILL.md` (after `bun install`)
- Full docs: `node_modules/deepsec/dist/docs/`

# Agent setup

This is the deepsec scanning workspace for **hakoot**. Project context lives
in `data/hakoot/INFO.md` (already filled in).

## Common tasks

- **Run a scan**: `bun run scan` (free, regex matchers only).
- **AI investigation**: `bun run process` — requires credentials in
  `.env.local` or a logged-in Claude/Codex CLI.
- **Write a custom matcher** (after a confirmed true positive): read
  `node_modules/deepsec/dist/docs/writing-matchers.md`.
- **Add another project**: `bunx deepsec init-project ../other-repo` from
  this directory.

## Reference

- Skill: `node_modules/deepsec/SKILL.md` (after `bun install`)
- Full docs: `node_modules/deepsec/dist/docs/`

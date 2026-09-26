# Lerner Works Website Platform

Agency-operated platform for creating, editing, reviewing and publishing multiple customers'
websites from one application. Built from `docs/Lerner-Works-Platform-Build-Guide.md`.

- Dashboard: `/app` · Public demonstration sites: `/demo/pine-hollow`, `/demo/range-athletics`
- Stack: Next.js 16 (App Router, TypeScript), PostgreSQL with row-level security
  (Supabase-compatible migrations), Tailwind CSS 4, Zod, Vitest, Playwright, pnpm.

## Quick start

```bash
corepack enable
pnpm install
pnpm db:start        # local PostgreSQL (or Supabase local stack when Docker + CLI exist); writes .env
pnpm db:migrate
pnpm seed:demo       # fictional fixtures; accounts in docs/local-accounts.md (git-ignored)
pnpm setup:check
pnpm dev             # http://localhost:3000
pnpm worker:dev      # notification jobs (local sink) in a second terminal
```

See `docs/OPERATIONS.md` for boundaries, resets, hosting steps and backups;
`docs/DECISIONS.md` for architecture; `docs/PROGRESS.md` for milestone state and the
feature ledger; `docs/ACCEPTANCE.md` for the acceptance matrix.

## Commands

| Command | Behavior |
|---|---|
| `pnpm setup:check` | Readiness report (runtime, container runtime, env, database, migrations) without secrets |
| `pnpm db:start` | Starts local database services; never selects production |
| `pnpm db:migrate` | Applies pending migrations without resetting data |
| `pnpm db:reset --yes` | Drops/recreates the local dev database (refuses non-local targets) |
| `pnpm seed:demo` | Loads repeatable fictional fixtures into the local database |
| `pnpm dev` / `pnpm worker:dev` | App server / notification worker |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm test` / `pnpm test:integration` / `pnpm test:e2e` | Unit / database + policy / browser workflows |
| `pnpm build` / `pnpm start` | Production build / production-mode server |
| `pnpm verify` | Release gate: setup check, lint, typecheck, unit, integration, e2e, build (`--skip-e2e`, `--skip-build` for partial runs) |
| `pnpm retention` | Purges rate-limit counters (1 day) and inquiries (90 days); refuses non-local targets without `--confirm-hosted` |
| `pnpm backup:local` / `pnpm restore:rehearsal <dir>` | Local backup and restore rehearsal into a new local database |

All demonstration content is fictional. Pine Hollow Guide and Range Athletics are not real
businesses, and no live Lerner Works property is touched by this repository.

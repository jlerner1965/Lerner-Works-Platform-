# Lerner Works Platform — working notes for Claude Code

The full specification is `docs/Lerner-Works-Platform-Build-Guide.md`. Read it before changing
architecture. Resume from `docs/PROGRESS.md`.

## Non-negotiable boundaries

- This repository is a new project. Never edit, deploy, or migrate Inside the Towns, AragoCor,
  or the existing Lerner Works website. Never move DNS. Never send real email.
- Real persistence only: PostgreSQL through the migrations in `supabase/migrations/`. No
  localStorage business records, no simulated saves, fake metrics or pretend deploy status.
- The public renderer reads immutable release snapshots only (`releases.snapshot` via the
  anon-callable read functions). It must never read draft tables.
- Authorization lives in server code plus row-level security. Every mutation validates the
  session, membership, site scope, input schema and capability. Client-supplied organization or
  site ids are never authority.
- Seeds, resets and the local auth provider run only against a local `_dev/_test/_e2e`
  database with `APP_ENV=local`.
- Do not invent credentials, provider success, prices or test results. Record blocked items in
  `docs/PROGRESS.md` and `docs/ACCEPTANCE.md` as BLOCKED, not PASS.
- Commits/pushes go only to the branch the session was configured for; no pull requests,
  remote repositories or public deployments without explicit approval.

## Commands

`pnpm setup:check`, `pnpm db:start`, `pnpm db:migrate`, `pnpm seed:demo`, `pnpm dev`,
`pnpm worker:dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`,
`pnpm test:e2e`, `pnpm build`, `pnpm start`, `pnpm verify`, `pnpm launch:check`,
`pnpm bootstrap:owner`. See `docs/OPERATIONS.md` and `docs/LAUNCH-CHECKLIST.md`.
Browser tests build and serve a production bundle in `.next-e2e` (`docs/DECISIONS.md` D-009);
`E2E_USE_BUILD=0` uses `next dev` for iteration only.

## Layout

See build guide section 7. Dashboard routes under `src/app/app`, public demo routes under
`src/app/demo`, previews under `src/app/app/sites/[siteId]/previews`, themes in `src/themes`,
content contracts in `src/modules`, server services in `src/server`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

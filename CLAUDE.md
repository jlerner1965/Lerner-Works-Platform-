# Lerner Works Platform — working notes for Claude Code

The full specification is `docs/Lerner-Works-Platform-Build-Guide.md`. Read it before changing
architecture. Resume from `docs/PROGRESS.md`. The design flexibility programme (phases D0–D3)
is planned in `docs/DESIGN-PLAN.md`; D0 and D1 are shipped, D2 (theme catalogue, design
preview, delegation) is built and goes to production on the owner's go. Themes are
compositions in code registered under immutable keys in `src/themes/index.ts` with their
capabilities declared in `src/themes/capabilities.ts` (decision D-018). The site-building
programme (`docs/SITE-BUILDING-PLAN.md`, decision D-020) is the current work: its bar is
that the owner would choose the platform over hand-building a site, and every change in it
is built to last (migration, service, tests at three levels, docs, release gate). B1 is
built: review policy per site with approval on save, one-step publishing, task-based
dashboard.
Public themes use only the derived brand tokens, design variables and font variables described
in `docs/DESIGN-TOKENS.md` (a unit test rejects literal colours in `src/themes`). A theme or
renderer change must keep every frozen release in `tests/fixtures/releases/` rendering as
recorded (`tests/unit/rendering-hash.test.ts`; re-record only after the screenshot comparison
in `docs/OPERATIONS.md`, decision D-015).

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
- Not a page builder (`docs/DECISIONS.md` D-017): never add a canvas, free positioning,
  per-element styling, custom CSS or HTML, a template gallery, generated pages or copy, or
  design controls for anyone but the agency (per-site delegation to a publisher stays off by
  default). Themes are compositions in code; sections are typed contracts; design settings are
  enumerated values.

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

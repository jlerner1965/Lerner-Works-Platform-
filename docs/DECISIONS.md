# Architecture decisions

Dated records of material decisions and why they fit the build guide. Ordinary reversible
implementation choices are not recorded here.

## D-001 · 2026-09-25 · Stack and pinned versions

Selected per guide section 7. Versions resolved from the npm registry at kickoff and pinned
in `package.json` / `pnpm-lock.yaml`:

| Package | Version | Note |
|---|---|---|
| next | 16.3.6 | App Router, TypeScript, Turbopack default; `proxy.ts` replaces `middleware.ts` |
| react / react-dom | 19.3.0 | |
| typescript | 5.9.3 | The latest 5.x line. TypeScript 7.0.x (the native compiler) is published but tooling compatibility (ESLint parser, Next plugin) was not yet universal, so the last JavaScript-based release is pinned. |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | CSS-first configuration |
| zod | 4.6.5 | |
| postgres (postgres.js) | 3.4.9 | Direct PostgreSQL driver |
| sharp | 0.35.4 | Image validation and derivatives |
| vitest | 4.1.11 | Unit and database integration tests |
| @playwright/test | 1.63.0 | Browser workflows |
| eslint / eslint-config-next | 10.11.0 / 16.3.6 | Flat config |
| pnpm | 10.33.0 | `packageManager` field; lockfile committed |

Node.js 22.22.2 was used. Primary sources: the Next.js guides bundled in
`node_modules/next/dist/docs/` for this exact version, https://nextjs.org/docs,
https://supabase.com/docs/guides/database/postgres/row-level-security,
https://supabase.com/docs/guides/local-development.

## D-002 · 2026-09-25 · Local services without a container runtime

The build environment has the Docker client but no daemon, so the Supabase CLI local stack
(`supabase start`) cannot run here. A PostgreSQL 16 server is installed locally. Decision:

- The schema, policies and functions are written once, in `supabase/migrations/`, in
  Supabase-compatible form (`auth.uid()`, `anon`/`authenticated`/`service_role` roles,
  pgcrypto in the `extensions` schema). They run unchanged on hosted Supabase.
- On a plain PostgreSQL server the migration runner first applies
  `supabase/local/0000_auth_shim.sql`, which recreates the minimal Supabase Auth surface
  (`auth.users`, `auth.uid()`) plus a **development-only** credential/session store
  (`local_auth` schema, bcrypt via pgcrypto). Hosted projects never receive the shim.
- `pnpm db:start` prefers `supabase start` when the CLI and a container runtime exist, and
  otherwise starts/uses the local PostgreSQL cluster and bootstraps roles and databases.
- Consequence: Supabase Auth and Supabase Storage are represented by provider interfaces.
  The local providers are the verified path in this environment; the hosted adapters remain
  **unverified** until a Supabase project is configured (tracked in the feature ledger).

This does not swap in a fake database: all persistence is real PostgreSQL with row-level
security enforced for every request.

## D-003 · 2026-09-25 · Request-scoped database identity

The application connects with a login role (`lw_app`) that owns no table privileges. Every
operation runs inside a transaction that sets `role` to `anon` or `authenticated` and sets
`request.jwt.claims` to the signed-in user's id, which is exactly what Supabase's PostgREST
does. Policies therefore execute with the real user's identity for every ordinary query,
and revoking a membership takes effect on the next request without a session refresh.
Elevated access (`lw_admin`, BYPASSRLS) is confined to migrations, seeds, the notification
worker and retention jobs (`src/server/data/elevated.ts`).

## D-004 · 2026-09-25 · Authority-carrying operations are SQL functions

Membership changes, invitations, site creation, release activation, restoration, media
withdrawal and public inquiry intake are `SECURITY DEFINER` functions with a fixed empty
`search_path`, explicit capability checks against `auth.uid()`, and minimal grants. Direct
table access for `authenticated` is limited to column lists in
`20260925000400_policies.sql`. `anon` has no table grants at all; it may only call the public
read functions, `submit_inquiry` and the invitation preview.

## D-005 · 2026-09-25 · Immutable releases and frozen candidates

A release candidate freezes a complete manifest (site identity, configuration revision,
content revisions, routes, redirects, media references, metadata) with a SHA-256 hash of its
canonical JSON. Activation copies the manifest into `releases.snapshot` inside one
transaction with a compare-and-swap on `sites.active_release_id` and an idempotency key.
Public rendering reads `releases.snapshot` through `get_demo_release`/`get_live_release`
only. Restoration creates a new release from a historical snapshot; it never rewrites history.

## D-006 · 2026-09-25 · Restricted structured body content

Body copy is stored as validated JSON blocks (paragraph, heading, list, quote, image) and
edited as a small line-based "structured text" markup. Inline links are limited to same-site
paths, stable item references (`item:<uuid>`) and https URLs. No HTML, MDX or scripts are
accepted or rendered.

## D-007 · 2026-09-26 · ESLint pinned to 9.39.5

`eslint-config-next@16.3.6` bundles `eslint-plugin-react@7.37.5`, which still calls the
`context.getFilename` API removed in ESLint 10. ESLint 10.11.0 therefore crashed on the first
rule; ESLint 9.39.5 (the latest 9.x, within the peer range `>=9.0.0`) is pinned instead.

## D-008 · 2026-09-26 · Self-hosted fonts instead of next/font/google

`next/font/google` failed to resolve under Turbopack in this environment
(`@vercel/turbopack-next/internal/font/google/font` not found) and, more importantly, it makes
every build depend on network access to Google Fonts. The three OFL typefaces (Source Serif 4,
Source Sans 3, Public Sans) are now bundled as woff2 latin subsets in `src/themes/fonts/` and
loaded through `next/font/local`, which self-hosts and preloads them. Licenses are recorded in
`src/themes/fonts/LICENSE.md`.

## D-009 · 2026-09-26 · Browser tests run against a production build

`pnpm test:e2e` builds the application into `.next-e2e` and serves it with `next start`
(`scripts/e2e-server.ts`). Under `next dev` (Turbopack, on-demand compilation) the ten-step
demonstration spec failed on two nested dynamic routes (`content/[itemId]/history` and
`media/[assetId]/file/[variant]`): when such a route was first requested while another route
was still compiling, the dev router answered 404 without invoking the page or handler and
kept doing so for the life of that process. The same requests succeed against a fresh
process and against the production build, whose route table is fixed. The production build
is also the artifact a release gate should exercise. `E2E_USE_BUILD=0` restores the dev
server for quick iteration on a single spec; results from that mode are not release evidence.

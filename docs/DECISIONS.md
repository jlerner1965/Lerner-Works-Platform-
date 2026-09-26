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

## D-010 · 2026-09-26 · Hosted sessions are issued by the platform, not carried as GoTrue tokens

With Supabase Auth the platform verifies credentials against GoTrue once (password grant)
and then issues its own opaque session: a random token in an httpOnly cookie whose SHA-256
hash lives in `public.app_sessions`. Resolving a request costs one indexed query and needs
no token refresh in the browser or in the proxy. The table has row-level security with no
policies and every PostgREST role revoked; the session functions in the private schema are
executable only by the application's connecting role (`lw_app`), which PostgREST never
assumes, so the hosted REST API cannot reach sessions. Elevated database access stays out of
request paths. Invitations create accounts through the administrative API with the password
the invitee chooses; password recovery uses GoTrue's PKCE recovery email so the platform
never sees or stores a recovery secret beyond the verifier cookie.

## D-011 · 2026-09-26 · Domain verification comes from the hosting provider's API; go-live is explicit

A hostname moves through pending → verifying → active only through SQL functions that check
organization ownership and write audit events. The "verified" fact is what the hosting
provider (Vercel project domains and domain configuration endpoints) reports; the dashboard
displays the provider's verification and DNS records verbatim and never infers a DNS value.
Serving a domain requires the site to be in live mode, which an owner switches on only when
an active release and an active, verified canonical domain exist. Leaving live mode stops
serving immediately and returns the site to the demonstration route. Without provider
credentials (local development) nothing is ever marked verified.

## D-012 · 2026-09-26 · Hosted environments must be fully configured before the first request

Outside `APP_ENV=local`, configuration validation requires https, a non-local database,
the Supabase auth and storage providers, the Resend notifier, the elevated connection and
the job secret, and it rejects the development-only providers. A hosted deployment with the
local disk store or the local mail sink would look healthy while losing uploads and sending
no email; failing fast at startup and reporting it in `pnpm launch:check` keeps that from
being mistaken for a working launch.

## D-013 · 2026-09-26 · Embeds: click-to-load video, map links, nothing else

Third-party embeds load scripts and cookies before a visitor has done anything, which costs
performance and privacy and widens the security surface. The platform therefore offers two
curated section types and no general embed: a **video** section for YouTube (privacy-enhanced
host) and Vimeo (do-not-track) that renders a poster from the platform's own media pipeline
and injects the player iframe only after the visitor activates it; and a **map link** section
that renders a directions button to the map provider built from an owner-approved address, with
no tiles or iframe on the page. Social embeds, arbitrary iframes and scripts stay unsupported.

## D-014 · 2026-09-26 · Design is agency-operated content, expressed in fixed vocabularies

Design settings (tokens, theme, section variants, focal points) are part of the immutable
site configuration revisions, frozen into release snapshots and rendered only from releases,
so a design change is published, checked and restorable like content. Design controls are
available to organization owners (the agency) and, per site and only when the agency switches
it on, to site publishers; editors and reviewers never see them. Flexibility comes from
enumerated tokens, variants and section types validated on write and before publication, never
from user-supplied HTML, CSS or scripts (D-006 stands). Every schema change bumps the snapshot
version and keeps earlier releases rendering unchanged. See `docs/DESIGN-PLAN.md`.

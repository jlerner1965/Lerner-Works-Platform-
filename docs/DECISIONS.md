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
Source Sans 3, Public Sans) were bundled as woff2 latin subsets and loaded through
`next/font/local`. Since D2 the files (six families) are served from `public/fonts/` with
hand-declared `@font-face` rules and a per-preset preload (D-019); the self-hosting rule
stands. Licenses are recorded in `public/fonts/LICENSE.md`.

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

## D-015 · 2026-09-26 · Rendering hashes detect change; screenshots judge it

Principle 3 of the design plan asks that upgrading the code leaves existing releases rendering
as they were. The markup itself cannot be frozen: any theme change (a new class, a CSS variable,
a wrapper element) alters the HTML of every release, including ones that never use the new
option. The check therefore has two parts. `tests/unit/rendering-hash.test.ts` renders every
route of the frozen pilot releases in `tests/fixtures/releases/` (exported by
`scripts/export-release-fixtures.ts`, including derived version-1 copies) with a fixed clock and
compares the SHA-256 of the HTML with the recorded values: an unintended change fails the
build. When a change is intended, the old releases are restored on a seeded database, the
screenshot pass is run and compared pixel by pixel with the previous evidence
(`scripts/screenshot-diff.ts`), the differences are reviewed and the hashes are re-recorded with
`UPDATE_RENDERING_HASHES=1`, with the reason noted in `docs/PROGRESS.md`. Acceptance row DES-09
reads accordingly. A stored release is never rewritten: older snapshot versions are normalised
at read time (`normalizeSnapshot`), which fills the defaults that make them render exactly as
before.

## D-016 · 2026-09-26 · D1 vocabulary: five section backgrounds, three hero overlays, owner-only design

The bounded design options of phase D1 are deliberately small. Section backgrounds are `default`,
`tint` (surface), `primary`, `accent` and `dark` (text colour); a "strong tint" band was built and
removed because it added pairings (accent on the strong surface) that a valid palette can fail,
which would have turned a palette that passes today into a blocked publication. Hero overlays are
three fixed strengths of the text colour over the image; the light one publishes with a warning.
Derived colours can be overridden only for the six tokens the themes use as surfaces and lines
(`surface`, `surfaceStrong`, `muted`, `border`, `borderStrong`, `focus`); the "on" colours and the
status colours stay derived so buttons and notices always read. Design settings are saved by
organization owners only (`canDesign`), audited as `design.updated`; the per-site delegation to
publishers planned in D-014 is not switched on in D1. Facts sections take owner-entered
label/value pairs only (no computed metrics, per the no-fake-metrics rule).

## D-017 · 2026-09-26 · The platform is not a page builder

Decided by the owner before phase D2, to keep the product from turning into a weaker version
of an online site builder. The platform never gets: a canvas or free positioning; per-element
styling; custom CSS or HTML from any user; a template gallery of near-identical skins;
generated pages or copy; design controls for anyone but the agency, other than an explicit
per-site delegation to a customer's publisher that stays off by default. What it offers
instead, and what the agency sells: compositions written in code by the agency (themes),
typed section contracts with content-only fields, enumerated design options validated on
write and at publication, and a publishing path (candidate, checks, atomic activation,
restore) that design changes share with content. The difference from a builder is the
content contracts and the publishing integrity, not the number of layout knobs. Phase D3
(visual, in-context editing) is optional and is decided only after D2 is in use with a
customer; it may only edit the same validated structures as the forms. Every phase's exit
review checks this decision (design plan principle 8).

## D-018 · 2026-09-26 · Theme catalogue rules

A theme is a composition written in code for one or more named presets, registered in
`src/themes/index.ts` under a key that is never reused or removed, because releases reference
it. It declares its capabilities in `src/themes/capabilities.ts` (presets, section types,
variants, header, hero and card styles and their defaults) and its rhythm and column defaults
in `src/themes/shared/design.ts`; a unit test enforces the declaration's invariants and renders
every route of the frozen pilot releases under every compatible theme. `design.theme` is
`default` (the preset's original composition) or a theme written for the site's preset; a
choice not written for the preset is refused on save, on package import and at publication
(`theme_unsupported`), and a stored configuration that carries one anyway resolves to the
preset's composition rather than failing to render. Configuration from before D2 has no theme
field and resolves to the original composition, so earlier releases render as published;
adding a theme must leave every existing theme's rendering hashes unchanged, and each new
composition gets its own frozen fixtures. Switching keeps the content: sections the new theme
does not render are listed when the switch is saved and block publication until an owner
changes them; nothing is rewritten automatically, and the design preview shows the result
before any candidate exists. A composition earns its place by a distinct hierarchy, navigation
and page structure (principle 5), not by recolouring: the catalogue is not a template gallery
(D-017). Compositions share the token, scale and section-band vocabulary of
`docs/DESIGN-TOKENS.md` and use no literal colours.

## D-019 · 2026-09-26 · Fonts are served from public/fonts, with metric fallbacks and a per-preset preload

The typography presets' files moved from `next/font/local` to `public/fonts/` (the same
self-hosted OFL latin subsets; D-008 stands, no request leaves the origin). Reason: `next/font`
can only preload every family in a page's module graph, so the D0 build preloaded nothing and
the browser swapped each family in after the first paint. The two D0 compositions absorbed
that, but the magazine composition's decks and bottom-anchored hero re-wrapped by a line and
moved the page: Lighthouse measured a cumulative layout shift of 0.13 to 0.20 on the magazine
pages against the 0.1 target of DES-13, and a metric-adjusted fallback cannot remove it (a
two-line paragraph still breaks differently by a word). The theme root now knows the preset in
use and preloads exactly its files (`<link rel="preload" as="font">`, hoisted into the head), so
the first paint already has them: on the unthrottled load Lighthouse observes, the shift is
0.00 on every page of both compositions, and at most 0.02 on a throttled 1.6 Mbps load. The
`@font-face` rules and each family's metric-adjusted local fallback live in
`src/app/globals.css` with the override values `next/font` had computed for these files; the
fallback faces name Times New Roman and Arial first and the metric-compatible Liberation,
Tinos and Arimo faces after them, because `local()` finds neither on Linux or ChromeOS and a
generic fallback re-wraps everything (Android has none of them, so there the preload alone
limits the swap). The files carry a one-year immutable cache header; a replaced file gets a
new name. Adding a family means fetching the latin subset, adding the `@font-face` rules and a
fallback face with computed metrics, declaring the family in `src/themes/fonts.ts` and
extending `public/fonts/LICENSE.md`. The change altered the theme root's class names and
added the preload links to every page, so the rendering hashes were re-recorded after the
screenshot comparison of D-015 (result in `docs/PROGRESS.md`).

## D-020 · 2026-09-26 · Site-building programme: the bar is the owner choosing the platform, built to last

The owner's bar, set after D2: the platform has to be good enough that they would use it to
build a client site instead of building the site by hand, and the result has to be
launch-ready and not look templated. An honest assessment against that bar
(`docs/SITE-BUILDING-PLAN.md`, section 1) found the fully populated pilots respectable but
template-like, a fresh site an empty scaffold, and the effort to populate a site higher than
hand-building. The programme in that plan fixes this in the order of impact, and every change
is built to last: migrations for data, services for rules, tests at the unit, integration and
browser levels, documentation and the release gate; no temporary screens or flags. Two rules
decided with phase B1. (1) A per-site review policy, off by default: a revision saved by
someone who may publish is approved on save, recorded as an immutable review row on that
exact revision and audited (`review.approved_on_save`); editors' work still needs a
publisher; with review required, nothing is approved without an explicit decision. Approval
never transfers to different bytes. (2) Publishing is one action: the next release is computed
from the saved and approved work without writing anything, blockers stop it before a candidate
exists, and the same computation is persisted as the candidate that is activated atomically;
the careful path (frozen preview, waivers) and restore remain. The dashboard is organised by
task: content by kind, Look, Publish, Inbox, Settings, Team, Import and export, Activity log.
D-017 stands throughout the programme.

## D-021 · 2026-09-26 · A section with nothing to show is left out; a fresh site is a structure, not a scaffold of notices

Before phase B2 a fresh site published as a page of placeholders ("No hero image selected
yet", "No places have been published yet", "This section has no text yet"), and every
placeholder was a visible defect on a client's site. Decided: (1) a section with nothing to
show is left out of the public page. One rule (`src/themes/shared/empty.ts`) decides it for
every composition: an empty rich text, feature list, quotes, facts or FAQ section, a
collection with no published items, a category list with no categories, a video without an
id, a map link without an address, a gallery whose images are missing. The renderers apply it
and print no notice; publication validation lists every section left out
(`section_left_out`) and warns when a whole page has nothing to show (`page_empty`); the
editor marks each slot with what fills it. The explicitly added list types (FAQ, quotes,
gallery, facts) still block publication when empty, as they did since D1: they are only ever
added on purpose. Index pages keep their empty states, because a page must show something.
(2) Starter pages are a structure whose slots fill themselves: the community guide's home
page has an introduction slot, a category list that lists the categories of the published
places, and collections of the latest places, upcoming events and latest articles; the
location business's home page has the introduction, the store finder and the services. The
category list is a new typed section (`category_list`, guide compositions only). No fictional
copy is generated anywhere: an empty slot is left out until the owner writes it, and the
setup checklist names it. (3) The onboarding package is the way from empty to launch: one
spreadsheet per content kind of the preset, a settings sheet for the brand, contact details and
the starter pages' text, and an images folder listed with alternative text and rights, imported
through the same dry-run-then-confirm step as a CSV file; images and settings are applied with
the content in one transaction. Imports follow the site's review policy (D-020): what someone
who may publish imports is approved on save when the site does not require review. The
renderer change altered no frozen release (the pilots have no empty sections), so no
rendering hash was re-recorded.

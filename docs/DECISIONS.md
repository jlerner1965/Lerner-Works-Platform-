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

## D-022 · 2026-09-26 · Richness stays inside the vocabulary: typed sections, enumerated treatments, compositions in code, no script for the lightbox or the band

Phase B3 of the site-building programme had to make a client site look art-directed
without crossing D-017. Decided: (1) richness is added only as typed sections and enumerated
options, validated on save, on import and at publication exactly like the sections of D1:
people (`team`), a logo strip (`logo_strip`), image-and-text rows whose sides alternate
(`image_text`), a photo band (`image_band`: a picture under a wash of one of three brand
colours at one of three strengths, the text in that colour's "on" token, a pairing the
contrast gate already checks), a portrait on each quotation, up to three more pictures on the
image hero with the treatments `offset`, `collage` and `statement`, a gallery lightbox, and
the rich text blocks divider, callout and button. Nothing positions, sizes or colours an
element freely. (2) No client script for any of it: the lightbox is drawn by `:target` CSS
(every thumbnail links to a hidden full-size copy; close, next and previous are links), the
band and the treatments are layout and CSS. The one client component added is the
click-to-load map, which extends D-013 to maps: the page shows the address on a plain panel
and requests nothing from Google Maps or OpenStreetMap until the visitor presses "Show map";
Apple Maps has no keyless embed and stays a link; the map follows the directions rule (live
site, owner-approved address; disabled on demonstration sites and previews). Measured cost
of the phase: one kibibyte of script on every public page (144 KiB against the 143 KiB
baseline, allowance 20 KiB). (3) A third composition per preset written in code with declared
capabilities like D-018: the almanac for the community guide (navigation rail, numbered
sections, fact sheets) and the practice for the location business (slim header with the phone
number, soft panels, numbered services, an hours table). Keys are immutable. (4) Snapshot
schema version 5 records the additions; every new field defaults to the earlier behaviour,
so the eight frozen releases of versions 1 to 4 render unchanged (no re-record), and version-5
fixtures of the pilots on the new compositions join the rendering-hash test. (5) In the
demonstration fixtures, image keys share the "@" reference namespace with item ids and the
loader resolves items first; the pictures of the stores were renamed so no key repeats an id,
and the rule is noted in the fixtures.

## D-023 · 2026-09-26 · The proof is two client sites built through the dashboard with public-domain photography, from the package a client fills in

Phase B4 of the site-building programme needed realistic client sites with real photography,
built the way a client's site would be, to judge the programme's bar. Decided: (1) the
photography is public domain: photographs from the Carol M. Highsmith Archive at the Library
of Congress ("no known restrictions on publication"), chosen by subject for a fictional
mountain town and a fictional family of farm markets, fetched by a reproducible script that
records each photograph's archive id, catalogue record and title, reduced to web size, and
committed with the attribution on every asset row and in `docs/evidence/ASSETS.md`. No
photograph is presented as the real place or business it shows, no business named on the
sites appears in a photograph, and no real person's likeness stands in for a fictional one:
the people and the members' marks stay stylised artwork, to be replaced by a client's own. (2)
The sites are written as onboarding packages (`src/server/demo/proof/`): typed content that
builds the ZIP a client would upload, so the proof exercises the client's own path (dry run,
import, compose, publish), the packages can be imported on production for the owner's
judgement, and the integration test imports and publishes them on every gate. (3) The measure
is the counted, timed dashboard build (`tests/e2e/proof.spec.ts`, `docs/evidence/proof/`):
screens, fields and actions per task are what a person does; the scripted time is recorded as
such, and the person's own timing on production is the number the bar is judged by. (4) What
the build found is fixed in the product, not worked around in the script: the proxy's default
10 MB body buffer truncated a package larger than that (raised to the 64 MB the import
promises); the settings sheet's opening picture had no effect on a home that opens with words
alone (it now becomes a picture hero when the composition offers one); and colours that would
fail the publication gate's contrast pairings passed the dry run (the dry run now refuses
them, naming the pairing).

## D-024 · 2026-09-27 · Documents are media, links are content, the workbook is read in code

The owner's review of B4 asked for PDFs beside the pictures, pages that are links to other
websites, and Excel instead of CSV in the onboarding package (site-building phase B5).
Decided: (1) A document is a media asset of kind `document` (`media_assets.kind`; the public
copies of D-005 unchanged): PDF only, checked by signature and trailer, 25 MB, one derivative
pointing at the private original and copied at publication to `<sha256>.pdf` like a
picture's derivatives, served inline with `X-Content-Type-Options: nosniff` and a
`Content-Disposition` name from the title. Nothing else is accepted (no Office files, no
archives): PDFs are what clients have and a browser renders them without a plug-in, and SVG
and HTML stay refused (D-006). A document is referred to as `document:<id>` wherever a link
target is typed (rich text, buttons, section links) and as an attachment (an id and a label)
on any item; the manifest collects documents with the pictures, and the validator refuses a
picture where a document is needed and the reverse, so a release never serves the wrong
kind. (2) A link to another website is a content kind (`link`, both presets), not a
navigation entry: the owner asked for content with a picture and text, which is an item with
a revision history, a category, a place in collections, in search and on an index, and the
review policy; the navigation's external links (D0) stay for the header. The address is
https only, every card and button that opens it carries `rel="noreferrer"`, and the item's
own page exists so that search and sharing have somewhere to land. The `/links` index and
its navigation entry appear once a link is published (D-021 applied to a route). (3) The
workbook is read and written by a small OOXML subset in `src/server/import/xlsx.ts` over the
zip library the package already uses, not by a spreadsheet dependency: shared and inline
strings, rich runs, dates by cell style, numbers, booleans and formulas by their cached
result, with limits on size, rows and columns. A workbook is converted to the package's CSV
files before the dry run (`src/server/import/workbook.ts`), so the import reads one shape and
a client may still send CSV files; a sheet given both ways is refused. The template is the
workbook, and the proof packages carry it.

## D-025 · 2026-09-27 · Removal: rows go, files follow, the trail stays, organizations become tombstones

The owner asked to delete sites and organizations after the proof (phase B6). Decided: (1)
Removal is an owner-only SQL function with a typed confirmation (the site key, the
organization name), so the rule sits with the data like every other authority-carrying
operation (D-004). (2) A site is deleted as rows in one transaction: every site-scoped table
cascades from `sites`, and the audit event `site.deleted` (key, name, preset, counts) is
written in the same transaction and survives, because `audit_events.site_id` carries no
foreign key; the organizations page lists the removed sites from that trail. (3) Files follow
the rows: the function returns the site's asset folders (private originals and derivatives)
and the public copies no other site's release carries, since public names are content hashes
and may be shared; the application removes them after the commit and records any it could not
remove as `site.storage_cleanup_failed` with the keys, so the operator finishes by hand rather
than the rows being kept for a storage error. (4) A site that is live on a domain is refused
until it is returned to demonstration mode and its domains are disabled: a deletion must
never be the way a live hostname goes dark. (5) An organization is not deleted as a row: its
sites go first (each as above), then its memberships and invitations, and the row stays as a
tombstone (`status = 'deleted'`, `deleted_at`, `deleted_by`) that no one is a member of, so
that the organization's audit trail, including the deletion, remains in the database for the
operator; the last organization a person owns is refused, because only an existing owner can
create the next one (the onboarding rule of `create_organization`). (6) There is no undo: the
dashboard says so and points at the site package export first.

## D-026 · 2026-09-27 · Uploaded sites: a finished site hosted as a release, previewed on a hostname of its own

The owner's verdict on the bar (SB-09) was that the structured platform is too complicated
and too constrained for the sites they build: they want to build a site anywhere and upload
it (phase B7). Decided, reversing D-006 and D-017 for this kind of site only: (1) A site has a
type. An uploaded site's release is a manifest of files (schema series 101 of
`releases.schema_version`), not content: the same table, the same immutability, the same
restore. Structured sites keep everything they have and gain nothing. (2) The ZIP is what a
static host serves: HTML, CSS, JavaScript, images, fonts, documents and media, by extension;
server-side files are refused, hidden files skipped, an index page at the root required, a
zipped folder's name dropped; 64 MB, 2,000 files, 25 MB a file. (3) Files are stored under
their content hash in the public store and the manifest maps the site's paths to them;
serving resolves a page without its extension, a folder's index and the site's own 404 page,
with the hash as the ETag and a minute at the CDN, so a new upload is visible within a minute
and unchanged files are not transferred again. (4) An uploaded site's JavaScript never runs
on the dashboard's origin: previews live on `<key>.<PREVIEW_DOMAIN>`, a hostname of their own
(a wildcard under the platform domain, which the Vercel-managed zone allows), and the demo
route redirects there; without a preview hostname there is no preview, never one on the
application host. (5) The proxy routes a customer hostname by asking the application which
kind of site it serves, through a public read function, remembered per instance for a minute;
the file handler answers only requests the proxy marked. (6) The contact form is the site's
own HTML posting to `/_lw/inquiry` on the site's address, read as a form post, stored by the
same function with the same limits and honeypot as the platform's forms, and answered with a
redirect back into the site carrying the receipt; a faulty post gets a plain page naming what
to correct. (7) Publication is one SQL function that inserts and activates, idempotent by
key; the files are copied before it runs, so a storage failure leaves no release that cannot
be served. (8) The dashboard of an uploaded site is Upload (with the releases and restore),
Inbox, Settings (details, domains, publishing mode), Team and the activity log; the structured
sections answer 404 for it.

## D-027 · 2026-09-27 · Large uploads in parts, a check that leaves out rather than refuses, GitHub as a source

**Context.** The owner's first real upload on production, a ZIP downloaded from GitHub, failed
twice over. The hosting platform refuses any request body over 4.5 MB before the application
runs (confirmed: a 6 MB post answers `413 FUNCTION_PAYLOAD_TOO_LARGE`, a 3 MB one reaches the
code), and the B7 check treated every file a website does not serve (LICENSE, CNAME, a build
script, source files) as an error that refused the whole upload. The owner asked whether to
fix the upload or to link GitHub.

**Decision.** Both, the upload first. (1) A ZIP goes up in parts through the platform itself:
`upload_sessions` records the file's name, size and part layout; each part is a request under
the limit, stored privately under the session; completing the session assembles the parts,
drops them and hands the archive to the same intake as a one-request upload. The parts travel
through the platform rather than straight to the storage provider so that the path is the same
on every provider, is exercised end to end by the browser tests, and puts no key in the page.
The one-request route stays for browsers without script and small files. Sessions left open
for a day and checks never published in thirty days are purged by the retention job with their
storage. (2) The check keeps what a website serves and leaves out the rest, listed by reason
(hidden, server-side, repository housekeeping, not served, a name a web address cannot carry,
`node_modules`, outside the chosen folder); server-side code gets a warning of its own. Names
may use letters and digits of any script. When the top level has no `index.html`, exactly one
of the usual build folders holding one is taken as the site, or the person names the folder;
a source project without a built page is told it has to be built first. Refusals remain for
what cannot be served at all: no index page, a path leaving the archive, an oversize file,
case twins, too many files. (3) A site may name a GitHub repository, branch and folder as its
source (`site_sources`); the archive is fetched server-side at the branch head through the
REST API (no request-size wall), checked and published like an upload, with the commit on the
release's `source.github` and the live commit remembered on the source. An organization may
store one GitHub token for private repositories (`organization_secrets`): verified with GitHub
before storing, sealed with AES-256-GCM under a key derived from SESSION_SECRET (no second
secret to configure; rotating SESSION_SECRET means pasting tokens again), reachable only
through security-definer functions (owners set and remove; people who may publish a site of
the organization use it through the application; the ciphertext column is not granted), never
shown back beyond its last four characters.

**Consequences.** Two optional variables (`UPLOAD_PART_BYTES`, `GITHUB_API_URL`), lowered and
pointed at a stand-in only by the browser tests. Publishing copies files to the public store
eight at a time. What neither path does, and what stays a separate decision: building a site
(React, Next, Astro, Vite) from its source.

## D-028 · 2026-09-27 · Client privileges are stated explicitly; the hosted defaults are off

**Context.** The read-only verification after applying the B8 migration to the production
project showed the `authenticated` role able to read `organization_secrets.ciphertext` and to
execute the purge functions, and `anon` able to select the three new tables. A Supabase
project grants `anon`, `authenticated` and `service_role` every privilege on new tables and
sequences and execute on new functions in `public` through the default privileges of the
`postgres` role; the plain PostgreSQL the tests run on has no such defaults, so no test could
see it. The policies migration of launch day revoked the tables of its day; everything created
since carried the defaults on production: the B8 tables, and every function in `public`
including `purge_old_inquiries` and `purge_rate_limit_events` (a signed-in user could have
called them with a zero interval). Row-level security kept the rows of every table in check
throughout; the exposure was the ciphertext column, the column-level restrictions of the B8
tables, and the purge functions.

**Decision.** Migration `20260927000600_hosted_grants_hardening.sql`: the tables created
after the policies migration get exactly the grants their migrations meant after a revoke
from `public, anon, authenticated`; execute on every function in `public` is revoked from the
client roles and the grants the migrations made are re-issued verbatim; the default privileges
of `postgres` in `public` are revoked for tables, sequences and functions where the migration
runs as `postgres` or a superuser (the hosted project; a local database skips it with a
notice). From now on every migration that creates a table or a function in `public` states
its client grants after an explicit revoke naming `anon` and `authenticated`, and
`tests/unit/migration-grants.test.ts` holds it to that: every table created after the policies
migration has such a revoke, the hardening migration re-issues every earlier function grant
(minus dropped signatures) and nothing more, and every function created after it revokes in
its own file. Applied to the production project at 05:32 UTC and verified read-only.

**Consequences.** A hosted verification (`has_column_privilege`, `has_function_privilege`,
`pg_default_acl`) belongs to every migration that adds a table or a function, in
`docs/OPERATIONS.md`; the local database cannot stand in for it.

## D-029 · 2026-09-27 · Push to deploy: a built site is handed over by the CI that built it

**Context.** The owner's sites are Astro projects (`jlerner1965/insidethetowns`: one codebase,
a site per town chosen by an environment variable, built by GitHub Actions on every push and
deployed by Vercel, rebuilt twice a day because listings are date-dependent). There is no
website in such a repository until the build runs, so Publish from GitHub (D-027) can never
publish one of them, and the platform does not build sites (`docs/LESSONS.md`, 7).

**Decision.** The route that works is the one the repository already walks: the CI builds,
then hands the built folder to the platform. A deploy token per site (`site_deploy_tokens`:
`lwd_` and forty hex characters, shown once, kept as a SHA-256 hash, revocable) authorises
`/api/deploy/begin`, `/api/deploy/part` and `/api/deploy/complete`, the same parts protocol as
the dashboard uploader (B8) with the token in place of a session. The token acts as the
person who created it: the release carries their name, and the token stops working when
they lose the right to publish the site (403) or revoke it (401). A clean check is published
at once as the next release with the commit and branch the CI names (`source.deploy`, the
release note "Push to deploy (label): branch @ commit"); a refused site answers 422 with the
reasons and leaves its check on the Upload page. `public/deploy.sh` makes the CI step five
lines: zip the folder, send it in parts, publish. Tokens are resolved through the elevated
connection; the hash column is not granted to the client roles (D-028).

A built site's own hosting configuration comes with it: `_redirects` and `_headers` in the
Netlify format, which generators and the owner's build already write, are read at inspection
into the release (`redirects`, `headers` on the manifest; schema series 101 unchanged, the
fields optional) and applied by the file handler: a redirect answers before any file, a
rewrite (200) serves another path, 404 the site's own page; headers from an allowlist
(content security policy, transport security, frame options, referrer and permissions
policies, cache control, CORS and cross-origin policies, robots, link, language, vary) are set
on matching paths, later rules winning; the platform keeps Content-Type, Content-Length, ETag
and nosniff, and a preview keeps its no-store and noindex whatever the site says.

**Consequences.** For a generator site the owner's steps are: create the site as *Uploaded*,
create a deploy token, add it as a repository secret, add the step after the build; a push
publishes. Scheduled rebuilds run the same job on a schedule. What stays out: building on the
platform, and per-site headers or redirects edited in the dashboard (the site's files carry
them).

# Design flexibility programme

Plan for the next stage of the platform, agreed with the owner on 2026-09-26: design first,
to full depth (from complete identity control through a theme catalogue to visual, in-context
editing), with the design controls as the agency's tools. Functional modules from the build
guide's "later modules" list are separate tracks and are not planned here.

Read `docs/Lerner-Works-Platform-Build-Guide.md` sections 6, 8 and 21 first; this document
extends them and never relaxes them. Decisions D-013 (embeds) and D-014 (who designs, and
where design lives) in `docs/DECISIONS.md` belong to this plan.

## 1 Where design flexibility stands

Before D0 (survey of 2026-09-26): an owner could change four brand colours, the wordmark and
tagline, up to eight flat navigation links, footer text and links, and which of eight fixed
section types a page has, in which order, with content-only fields. Everything else was
decided in code by the site's preset: composition, fonts, component appearance, per-kind
templates, image crops.

Gaps found in that survey, and their state after D0 (shipped 2026-09-26, see section 4):

- `branding.logoAssetId` and `branding.typography` were saved but never rendered → both
  render (logo in the header of both themes and in the retail footer, with the wordmark as
  fallback and as alternative text; the guide footer sits on the primary colour and keeps
  the wordmark; typography preset applied through `--font-heading` / `--font-body`).
- Many theme colours were literal hex values, so a recolour was incomplete; the contrast gate
  did not cover white text on accent buttons → every colour is a token derived from the four
  brand colours (`docs/DESIGN-TOKENS.md`), a unit test forbids literal colours in
  `src/themes`, and the gate checks fifteen pairings including button text and tinted panels.
- Page `body` and featured image were editable but never rendered → the featured image is
  the page's header image (unless the page opens with an image hero) and its share image;
  the body field stays out of the page editor and is not rendered.
- Customer page titles carried the platform's title suffix; the platform favicon and
  `lang="en"` applied to every customer site; there was no share image → titles are the
  site's own, favicon is an uploaded image or a generated monogram, `lang` comes from the
  site's language field, share images come from the page or the site.
- Index titles and intros and the "Search" link were hard-coded → editable per module in
  Settings → Listing pages; the Search link can be switched off. The retail theme's "Find a
  store" header button stayed part of that theme's composition until D2 made the header
  button a configuration field (`navigation.cta`) of every composition, with "Find a store"
  as the retail default.
- The `inquiries` module switch was not enforced by the submission endpoint or store pages →
  `submit_inquiry` refuses submissions when the active release has the module off; store
  pages show no form.

## 2 Principles carried into every phase

1. **Fixed vocabularies, validated twice.** Design is expressed as tokens, enumerated options,
   section types and variants defined in `src/modules`, validated by zod on write and again
   before publication. No raw HTML, CSS, scripts or MDX from any user (D-006 stands).
2. **Design is content.** Design settings live in immutable site configuration revisions,
   are frozen into release snapshots, and reach the public renderer only through a release.
   Changing the design of a live site is a publication like any other: candidate, checks,
   atomic activation, restorable.
3. **Old releases render exactly as they were.** Every schema change bumps the snapshot
   `schema_version`; renderers keep the code path for earlier versions, and a rendering-hash
   test proves that upgrading the code does not change the output of an existing release.
4. **Quality gates are computed, not promised.** Contrast is checked for every colour pairing
   a chosen variant produces; images keep dimensions, sizes and alt text; the public bundle
   has a measured JavaScript budget; both pilots keep the Lighthouse targets of section 21
   after each phase.
5. **Presets stay distinct compositions.** The catalogue adds compositions; it never turns the
   two pilots into the same page recoloured.
6. **Keyboard first.** Every design control, including drag-and-drop, has an equivalent
   keyboard path; Move up/Move down stays.
7. **The agency designs.** Design controls are for organization owners (the agency), with an
   explicit per-site delegation to publishers when the agency chooses. Editors and reviewers
   never see them (D-014).
8. **Not a page builder (D-017).** The platform never gets a canvas, free positioning,
   per-element styling, custom CSS or HTML, a template gallery of near-identical skins, or
   generated pages and copy. Flexibility is always a choice among options the agency composed:
   a theme is a composition written in code, a section is a typed contract, a design setting is
   an enumerated value. Any phase that would need one of the excluded things to meet its goal
   changes its goal, not the boundary. Every phase's exit review checks this principle.

## 3 Architecture changes shared by the phases

| Area | Change |
|---|---|
| Design tokens | `siteConfig.design.tokens`: palette (the four brand colours plus derived surface, muted text, border and focus colours, computed by documented formulas with optional overrides), typography preset, radius scale, density, container width. Themes render tokens as CSS variables on their root and use no literal colours. |
| Section variants | Each section carries `variant` and `appearance` (background, alignment, columns, image aspect) from per-type enumerations in `src/modules/page.ts`; the allowed set depends on section type, preset and theme, and publication validation rejects anything else. |
| New section types | FAQ, quotes, call-to-action banner, gallery, facts list, video (curated, click-to-load), map link. Same registry pattern as the existing eight. |
| Media focal point | `media_assets.focal_point` (x, y in 0–1) set in the media library; every crop and `object-position` derives from it. |
| Theme catalogue | `siteConfig.design.theme` selects a composition compatible with the preset; each theme declares the section types and variants it supports; switching is a configuration revision checked at publication. |
| Design preview | A preview that renders the current configuration revision over the active release, for owners, before any candidate exists. |
| Visual editing | The preview becomes editable in context through a message bridge: select a section, edit its fields in a side panel (the same zod schemas), reorder by pointer or keyboard, adjust tokens live; saving stays explicit. |
| Permissions | A `design` capability: organization owners always, site publishers when the site's `design.delegateToPublishers` is on; server actions and RLS policies enforce it; every design change writes an audit event. |

## 4 Phases

### D0 · Identity completeness — DONE 2026-09-26

Make the existing controls real and remove dead ends. One working session.

- Render the logo with the wordmark as fallback, in both themes (build guide line 322).
- Apply the typography preset; both families are already self-hosted (D-008).
- Replace literal colours in `src/themes` with tokens; add derived surface, muted, border and
  focus colours; extend the contrast gate to every generated pairing, including white text on
  accent buttons and text on tinted backgrounds.
- Per-site favicon and share image (media assets), correct page-title template without the
  platform suffix, `lang` from a per-site language field (default `en`).
- Editable index titles and intros, optional "Search" link, external navigation links (with
  `rel` handling), footer variants (compact / columns).
- Remove the page `body` and featured-image fields from the page editor or render them;
  decision: render the featured image as an optional page header image, drop the body.
- Enforce the `inquiries` switch on the submission endpoint and on store detail pages.

Exit: DES-01 to DES-05 PASS; `pnpm verify` green; screenshots of both pilots at 390/768/1440
with the logo, fonts and derived colours in place; Lighthouse re-run recorded.

What shipped, and where:

| Item | Implementation |
|---|---|
| Derived tokens and gate | `src/lib/brand-tokens.ts` (formulas in `docs/DESIGN-TOKENS.md`); `validateManifest` blocks on any failing pairing; Settings → Brand shows all pairings live; `tests/unit/brand-tokens.test.ts` also audits `src/themes` for literal colours |
| Theme root | `src/themes/shared/site-root.tsx`: tokens as CSS variables, typography preset as `--font-heading`/`--font-body`, `lang`, logo (`BrandMark`), external-link handling, index copy, page header image, inquiries switch |
| Configuration (schema, defaults) | `navigation.showSearch`, `footer.variant`, `indexes.<module>.{title,intro}`, `metadata.language`, `metadata.faviconAssetId`, `metadata.shareImageAssetId`; snapshot schema version 2, version-1 releases normalised at read time (`normalizeSnapshot`) and never rewritten |
| Public metadata | `publicMetadata` in `src/server/publishing/render.ts`: `title.absolute`, icons (asset or `/favicon.svg` monogram route), Open Graph image, canonical; `<html lang>` from the proxy's `x-lw-public-site` marker through the root layout |
| Inquiries switch | migration `20260926000100_inquiries_switch.sql` (`submit_inquiry` checks the active release); store and service pages hide the form and prompt |
| Settings | Brand (logo hint, presets, pairings), Navigation and footer (Search link, footer layout, https links), Listing pages (new card), Site metadata (language, favicon, share image) |
| Pilots | Generated logos for both pilots and a share image for Pine Hollow in the demonstration fixtures |

Deferred from D0 to D1 with reasons: a second logo for dark surfaces (the guide footer is
primary-coloured; a dark logo on it needs a light variant, which the D1 token overrides and
header/footer style options cover); configurable "Find a store" header button (D1 header
style).

### D1 · Bounded design options — DONE 2026-09-26 (on production)

The main flexibility step, without a page builder. About three sessions.

- Site-level options: header style (left, centred, overlaid on hero), hero style, card style
  (image top, image side, text only), radius scale, density, container width, section
  background palette.
- Section variants and appearance for all existing section types (columns, grid or list,
  alignment, overlay strength, background).
- New section types: FAQ (accessible accordion), quotes (attribution required), call-to-action
  banner, gallery (captions, focal point), facts list (owner-entered label/value pairs only),
  video and map link per D-013.
- Media focal point in the media library with a live crop preview.
- Rich text gains bold and italic; still no HTML.
- Snapshot `schema_version` bump with the rendering-hash test of principle 3.

Exit: DES-06 to DES-09 PASS; both pilots re-composed with the new options where it improves
them; Lighthouse and bundle budget recorded.

What shipped, and where:

| Item | Implementation |
|---|---|
| Site-level options | `siteConfig.design` (`src/modules/site-config.ts`): header, hero and card style (`default` resolves per theme), radius, density, container, six derived-colour overrides; Settings → Design card for organization owners (`canDesign`), audited as `design.updated`; variables and scales in `src/themes/shared/design.ts`, documented in `docs/DESIGN-TOKENS.md` |
| Theme capabilities | `src/themes/capabilities.ts` declares per theme the section types, the variants of each type, the header/hero/card styles and their defaults; checked on save (`saveItemAction`), on package import (dry run) and at publication (`variant_unsupported`, `design_unsupported`); the editor offers only the declared choices (DES-06) |
| Section variants and appearance | Every section carries `variant` and `appearance` (background `default/tint/primary/accent/dark`, alignment, width); `SectionFrame` renders coloured bands with the `--section-*` variables so every pairing inside a band is one the contrast gate checks; variants per type in `sectionVariants` (hero split/full/stacked, collections grid/list/cards/featured, rich text columns/lead, …) |
| New section types | FAQ (native `<details>` accordion, no script), quotes, call-to-action banner, gallery (columns, aspect, captions), facts (owner-entered label/value pairs), video (click-to-load, D-013) and map link (directions button from an approved address); publication rules `empty_section`, `cta_incomplete`, `video_incomplete`, `video_no_poster`, `hero_overlay_light`, `map_no_address`, `map_unapproved` |
| Media focal point | migration `20260926000200_media_focal_point.sql` (`media_assets.focal_x/focal_y`); focal point editor with live crop previews on the media asset page (`setFocalPointAction`); frozen into `snapshot.media[*].focal` and rendered as `object-position` by `Picture`; carried by the site package export/import; a focal-point change alone shows as "Media changed" in the candidate summary (DES-07) |
| Rich text | `**bold**` and `_italic_` emphasis in `src/lib/richtext.ts`, rendered as `<strong>`/`<em>`; still no HTML |
| Snapshot schema | version 3; `normalizeSnapshot` parses older releases' configuration and item payloads through the current schemas at read time (defaults for design, variants, appearance) and never rewrites the stored release |
| Rendering hashes | `tests/unit/rendering-hash.test.ts` over `tests/fixtures/releases/` (exported by `scripts/export-release-fixtures.ts`, with derived version-1 copies); intended changes are reviewed with `scripts/screenshots.ts` + `scripts/screenshot-diff.ts` on restored old releases and re-recorded (D-015) |
| Pilots | Pine Hollow: facts, tinted quotes band and a primary call-to-action band on the home page, FAQ and gallery on About, hero focal point; Range Athletics: full-width hero with a focal point, inline facts, services as cards, accent call-to-action, FAQ and map link on Contact, small radius |

Not in D1, carried to D2: header overlaid on the hero and the configurable "Find a store"
header button (both need the composition work of the theme catalogue); per-site delegation of
design to publishers (D-016 keeps design owner-only until a customer asks); a second logo for
dark surfaces.

### D2 · Theme catalogue and design preview — BUILT 2026-09-26 (production on the owner's go)

About three sessions.

- Theme registry with capability declarations; at least one additional composition per
  preset (guide: magazine; locations: bold storefront), each a real composition with its own
  hierarchy, navigation and page structure.
- Theme selection and switching per site as a configuration revision; compatibility check at
  publication; migration notes for sections a theme does not support.
- Design preview route for owners rendering the draft configuration over the active release,
  with a device-width switcher (390/768/1440).
- Additional typography presets from licensed, self-hosted families (OFL only).

Exit: DES-10 and DES-11 PASS; a site switched between themes and back with identical earlier
releases; screenshots per theme.

What shipped, and where:

| Item | Implementation |
|---|---|
| Theme registry | `src/themes/index.ts` registers the four compositions under immutable keys (`guide`, `locations`, `magazine`, `storefront`; `themeKeys` in `src/modules/site-config.ts`); `getTheme(snapshot)` resolves `design.theme` through `themeKeyFor(preset, design)`, so a release renders with the theme it was published with, and configuration from before D2 (no theme field) resolves to the preset's original composition (D-018) |
| Capability declarations | `themeCapabilities` in `src/themes/capabilities.ts`: per theme the presets it is written for, a one-sentence description, section types, variants per type, header/hero/card styles and their defaults; `themesForPreset` lists the compatible compositions with the preset's own first; `themeCompatibilityIssues` refuses a theme not written for the site's preset on save, in the package import dry run and at publication (`theme_unsupported`); the rhythm and column defaults of each composition are declared in `src/themes/shared/design.ts` (`docs/DESIGN-TOKENS.md`) |
| Theme switching | Settings → Design → Theme (the preset default plus each compatible composition with its description); a switch is a configuration revision audited as `design.updated`; composition choices the new theme does not offer reset to its default with a note; the save answers with the migration notes of the plan: the theme change, and every page whose sections the new theme does not render ("Publication is blocked until it is changed"); publication then blocks with `variant_unsupported` / `design_unsupported` naming the page and field |
| Magazine composition | `src/themes/magazine` for the community guide: centred masthead with a date line and rule-lined navigation, full-width feature hero, collection grids with a featured lead, boxed facts, article pages with deck, byline, drop cap and a "More from the guide" sidebar, dark footer; renders all fifteen section types |
| Storefront composition | `src/themes/storefront` for the location business: dark header bar with the store finder laid over the opening hero from 768 px (`header: overlay`), bleed hero, store tiles with live status badges, numbered service rows, a dark status strip on store pages, a footer listing the stores; renders all fifteen section types |
| Design preview | `/app/sites/{siteId}/previews/design` (owners, or the publishers of a delegated site): the current configuration revision rendered over the active release (`loadDesignPreview` in `src/server/publishing/design-preview.ts`) at 390/768/1440 with a device-width switcher; assets the draft references but no release carries are served through the dashboard's private media route; a banner names the configuration revision, theme and release; `noindex`, no inquiry endpoint; nothing is written |
| Delegation | migration `20260926000300_design_delegation.sql`: `sites.design_delegated`, `set_design_delegation()` (organization owners only, audited as `design.delegation_changed`) and a trigger that refuses a configuration revision changing `design` unless its author is an owner or the site is delegated; `canDesign` is owner, or publisher of a delegated site; the switch itself is shown to owners only |
| Header button and overlay | `navigation.cta` (label plus an internal path or https link, checked at publication like every navigation target) renders as the header button of all four compositions and replaces the retail default "Find a store" when set; `header: overlay` is declared by the storefront only |
| Dark-surface logo | `branding.logoDarkAssetId`, used where the brand sits on the primary colour or a dark band (guide and magazine footers, the storefront header bar); without it those places keep the wordmark, never a logo drawn for the light background |
| Typography presets | three added in `src/themes/fonts.ts`: Classic serif (Lora headings, Source Sans 3 text), Modern grotesk (Inter), Friendly rounded (Nunito), self-hosted latin subsets under the SIL Open Font License (`public/fonts/LICENSE.md`); no request leaves the origin. Font delivery changed with them (D-019): the files are served from `public/fonts/` with metric-adjusted fallback faces in `globals.css`, and the theme root preloads the files of the preset in use, so the swap no longer moves the page (the magazine's decks had measured a layout shift of 0.13–0.20 before) |
| Snapshot schema | version 4 (`design.theme`, `branding.logoDarkAssetId`, `navigation.cta`); older releases normalised at read time; the version-1 to version-3 rendering hashes are unchanged, and version-4 fixtures of both pilots on the new compositions join the rendering-hash test |
| Tests | unit `themes.test` (catalogue invariants, resolution and compatibility, configuration defaults, typography presets, and every route of the frozen version-3 releases rendered under every compatible theme); integration `themes.test` (DES-10 switch, preview, publish, restore, switch back; incompatible theme refused on save, at publication and on package import; DES-11 delegation at the action and at the database, audited; editors and reviewers denied); e2e `themes.spec` (the same in the browser, both pilots) |

Exit review against principle 8 (not a page builder, D-017): D2 adds no canvas, positioning,
per-element styling, custom CSS or HTML, template gallery, generated content, or design control
outside the agency. The two compositions are code written for one preset each; the theme
select offers only compositions written for the site's preset; the design preview renders the
same validated configuration through the same renderer and edits nothing; delegation is one
explicit per-site switch held by the owner and enforced in the database; the header button
and the dark logo are typed configuration fields checked at publication. Each preset has two
compositions that differ in hierarchy, navigation and page structure, not in colour
(principle 5).

Carried from D1 and closed in D2: the header overlaid on the hero, the configurable header
button, the dark-surface logo and the per-site delegation switch. Still open: further video
providers (section 7); whether D3 happens at all.

Exit review, 2026-09-26: DES-10 and DES-11 PASS (`docs/ACCEPTANCE.md`); both pilots switched
to the new compositions and back with every earlier release rendering as before (rendering
hashes over eight frozen releases; the screenshot comparison of the restored original
compositions against the D1 evidence differs only in the footer release number); screenshots
per composition in `docs/evidence/screenshots/magazine/` and `storefront/`; DES-13 performance
and layout-shift targets met on all eight measured pages, with the LCP target missed on four
(the guide home as at every phase, the magazine home and about, the storefront store detail
by 0.02 s; `docs/evidence/LIGHTHOUSE.md`); DES-14 unchanged at 143 KiB. Two findings of the
first measurement were fixed in the phase: the magazine's layout shift (font delivery, D-019)
and the storefront tiles' city label contrast.

### D3 · Visual, in-context editing — OPTIONAL

Four to six sessions. Optional by the owner's decision of 2026-09-26: it is decided only after
D2 is in use with a real customer, on evidence that the form-based editor and the design
preview leave a daily task slow or error-prone. It is a convenience layer over the same
structures, never a capability, and it is the phase closest to the boundary of principle 8.

- Editable preview: section outlines, click or keyboard selection, side panel with the
  section's form, live token controls, drag-and-drop reordering with keyboard equivalent,
  undo within the session, explicit Save draft / Request review / Preview as today.
- No free positioning, no custom CSS, no arbitrary components: the editor edits the same
  validated structures as the forms. Nothing in D3 may add a control that principle 8
  excludes; if a wanted convenience needs one, the convenience is dropped.
- Same review and publication path; the visual editor never bypasses candidates and checks.

Exit: DES-12 to DES-14 PASS; usability check of the daily workflows in build guide section 5
with the visual editor; accessibility spot checks with keyboard and screen reader.

## 5 Acceptance rows

These rows move into `docs/ACCEPTANCE.md` with evidence as each phase ships; until then they
are NOT RUN.

| ID | Scenario | Expected |
|---|---|---|
| DES-01 | Upload a logo and publish | Logo renders in the header of both themes and in footers that sit on the site background, with correct dimensions and alt text; wordmark shown when no logo, and on the guide's primary-coloured footer until a dark-surface logo variant exists (D1) |
| DES-02 | Switch the typography preset | Public fonts change on the next release; no external font request |
| DES-03 | Change the four brand colours to a new palette | Every public surface follows (no literal colour remains); a rendering audit lists zero hard-coded colours in `src/themes` |
| DES-04 | Choose a palette or variant with an unreadable pairing | Publication is blocked with the pairing named, including buttons and tinted sections |
| DES-05 | Set favicon, share image and language | Customer pages carry them; no platform title suffix; `lang` matches |
| DES-06 | Choose a section variant not allowed for the theme | Rejected on save and at publication with a clear message |
| DES-07 | Set a focal point and publish | Every crop of that image keeps the focal region at 390/768/1440 |
| DES-08 | Add a video section and load the page | No third-party request before the visitor activates it; player loads only after the click; keyboard operable |
| DES-09 | Upgrade the renderer after a schema change | The recorded rendering hash of every existing release either matches, or every difference was reviewed on the restored old releases with the screenshot comparison and re-recorded with the reason noted (D-015); older releases are normalised at read time and never rewritten |
| DES-10 | Switch a live site's theme and back | New composition after publication; earlier releases render as before; restore works |
| DES-11 | Editor, reviewer and non-delegated publisher open Settings | No design controls; direct requests denied; delegation switch grants publishers |
| DES-12 | Reorder and edit sections in the visual editor by keyboard only | Same result as the forms; explicit save; unsaved-changes warning |
| DES-13 | Lighthouse on both pilots after each phase | Mobile performance median ≥ 90, CLS ≤ 0.1, LCP ≤ 2.5 s (lab), recorded |
| DES-14 | Public JavaScript budget | Measured at D0 as the baseline; no phase exceeds it by more than the recorded allowance |

## 6 Sequencing and estimates

| Phase | Rough size | Depends on |
|---|---|---|
| D0 | 1 session | nothing |
| D1 | 3 sessions | D0 (tokens, contrast gate) |
| D2 | 3 sessions | D1 (variants, capability declarations) |
| D3 (optional) | 4–6 sessions | D2 in customer use; a decision by the owner on evidence |

Sizes are rough and sequential, not commitments. Each phase ends with `pnpm verify`, the
screenshot pass, the Lighthouse run, and updates to `docs/PROGRESS.md`, `docs/ACCEPTANCE.md`
and `docs/RELEASE-REPORT.md`. Production deploys through `main` as today; a phase is complete
only when it runs on production and the owner has seen it on a pilot.

## 7 Open points for the owner

- Font families for the additional typography presets: only OFL-licensed, self-hosted
  families are proposed; name any brand fonts you hold licences for.
- Video providers beyond YouTube and Vimeo, if any customer needs one.
- Delegation of design to a customer's publisher stays off by default (confirmed by the
  boundary decision of 2026-09-26, D-017); it is a per-site switch the agency turns on.
- Whether D3 happens at all: decided after D2 is in customer use (see D3), and after the
  site-building programme (`docs/SITE-BUILDING-PLAN.md`) has made the daily paths fast; the
  owner's feedback of 2026-09-26 (the dashboard was hard to navigate; a fresh site was an
  empty scaffold) is being answered there first.

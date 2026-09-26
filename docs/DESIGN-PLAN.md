# Design flexibility programme

Plan for the next stage of the platform, agreed with the owner on 2026-09-26: design first,
to full depth (from complete identity control through a theme catalogue to visual, in-context
editing), with the design controls as the agency's tools. Functional modules from the build
guide's "later modules" list are separate tracks and are not planned here.

Read `docs/Lerner-Works-Platform-Build-Guide.md` sections 6, 8 and 21 first; this document
extends them and never relaxes them. Decisions D-013 (embeds) and D-014 (who designs, and
where design lives) in `docs/DECISIONS.md` belong to this plan.

## 1 Where design flexibility stands (2026-09-26)

An owner can change four brand colours, the wordmark and tagline, up to eight flat navigation
links, footer text and links, and which of eight fixed section types a page has, in which
order, with content-only fields. Everything else is decided in code by the site's preset:
composition, fonts, component appearance, per-kind templates, image crops.

Gaps found in the code survey that the programme closes first:

- `branding.logoAssetId` and `branding.typography` are saved but never rendered.
- Many theme colours are literal hex values, so a recolour is incomplete; the contrast gate
  does not cover white text on accent buttons.
- Page `body` and featured image are editable but never rendered.
- Customer page titles carry the platform's title suffix; the platform favicon and `lang="en"`
  apply to every customer site; there is no share image.
- Index titles and intros, the "Search" link and the "Find a store" button are hard-coded.
- The `inquiries` module switch is not enforced by the submission endpoint or store pages.

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

### D0 · Identity completeness

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

### D1 · Bounded design options

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

### D2 · Theme catalogue and design preview

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

### D3 · Visual, in-context editing

Four to six sessions; start only after D2 is in use.

- Editable preview: section outlines, click or keyboard selection, side panel with the
  section's form, live token controls, drag-and-drop reordering with keyboard equivalent,
  undo within the session, explicit Save draft / Request review / Preview as today.
- No free positioning, no custom CSS, no arbitrary components: the editor edits the same
  validated structures as the forms.
- Same review and publication path; the visual editor never bypasses candidates and checks.

Exit: DES-12 to DES-14 PASS; usability check of the daily workflows in build guide section 5
with the visual editor; accessibility spot checks with keyboard and screen reader.

## 5 Acceptance rows

These rows move into `docs/ACCEPTANCE.md` with evidence as each phase ships; until then they
are NOT RUN.

| ID | Scenario | Expected |
|---|---|---|
| DES-01 | Upload a logo and publish | Logo renders in header and footer of both themes with correct dimensions and alt text; wordmark shown when no logo |
| DES-02 | Switch the typography preset | Public fonts change on the next release; no external font request |
| DES-03 | Change the four brand colours to a new palette | Every public surface follows (no literal colour remains); a rendering audit lists zero hard-coded colours in `src/themes` |
| DES-04 | Choose a palette or variant with an unreadable pairing | Publication is blocked with the pairing named, including buttons and tinted sections |
| DES-05 | Set favicon, share image and language | Customer pages carry them; no platform title suffix; `lang` matches |
| DES-06 | Choose a section variant not allowed for the theme | Rejected on save and at publication with a clear message |
| DES-07 | Set a focal point and publish | Every crop of that image keeps the focal region at 390/768/1440 |
| DES-08 | Add a video section and load the page | No third-party request before the visitor activates it; player loads only after the click; keyboard operable |
| DES-09 | Upgrade the renderer after a schema change | Rendering hash of every existing release is unchanged |
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
| D3 | 4–6 sessions | D2 (design preview) |

Sizes are rough and sequential, not commitments. Each phase ends with `pnpm verify`, the
screenshot pass, the Lighthouse run, and updates to `docs/PROGRESS.md`, `docs/ACCEPTANCE.md`
and `docs/RELEASE-REPORT.md`. Production deploys through `main` as today; a phase is complete
only when it runs on production and the owner has seen it on a pilot.

## 7 Open points for the owner

- Font families for the additional typography presets: only OFL-licensed, self-hosted
  families are proposed; name any brand fonts you hold licences for.
- Video providers beyond YouTube and Vimeo, if any customer needs one.
- Whether delegation of design to a customer's publisher should ever be on by default (the
  plan says off).

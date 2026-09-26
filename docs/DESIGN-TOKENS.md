# Design tokens

How a site's four brand colours become every colour the public themes render, and how the
publication gate checks them. Implementation: `src/lib/brand-tokens.ts`; the themes receive
the tokens as CSS custom properties from `src/themes/shared/site-root.tsx`. Introduced in
design programme phase D0 (`docs/DESIGN-PLAN.md`).

## Inputs

`branding.colors`: `primary`, `accent`, `background`, `text` (6-digit hex). The derived
colours follow the formulas below. Since D1, `design.overrides` may replace six of them
(`surface`, `surfaceStrong`, `muted`, `border`, `borderStrong`, `focus`) with a 6-digit hex
colour; an empty override keeps the derived value, and the gate below checks the result exactly
as it checks derived colours. The "on" colours and the status colours are always derived.

## Derived tokens

Mixing is per sRGB channel: `mix(a → b, t) = a + (b − a) · t`, rounded to whole channels.

| Token | CSS variable | Formula | Used for |
|---|---|---|---|
| surface | `--brand-surface` | mix(background → text, 4 %) | forms, callouts, notices, hero placeholders |
| surfaceStrong | `--brand-surface-strong` | mix(background → text, 9 %) | stronger tint; available to themes and as an override target (the D1 bands use `surface` for the tinted band, see below) |
| muted | `--brand-muted` | text mixed toward background by 40 %, 35 %, … 5 %; the first step that keeps 4.5:1 against both background and surfaceStrong; else text | secondary text: dates, bylines, hints, captions |
| border | `--brand-border` | mix(background → text, 18 %) | decorative rules, dividers, card outlines |
| borderStrong | `--brand-border-strong` | background mixed toward text from 35 % upward in 5 % steps; the first with 3:1 against background and surface; else text | form field borders, dashed empty-state boxes |
| focus | `--brand-focus` | first of accent, primary, text with 3:1 against background and surfaceStrong | keyboard focus rings on public pages |
| onPrimary | `--brand-on-primary` | white if white reads at 4.5:1 on primary; else the first of text, background, `#111111` that does; else the best of them | text on primary buttons, the guide footer, filter chips |
| onAccent | `--brand-on-accent` | same rule on accent | text on accent buttons and the retail demo banner |
| onText | `--brand-on-text` | same rule on text | text on the demonstration banner and the skip link |
| danger | `--brand-danger` | `#b42318` stepped 5 % at a time toward black (light background) or white (dark background) until 4.5:1 against background and surface | cancelled events, closed stores, form errors |
| dangerSoft | `--brand-danger-soft` | mix(background → danger, 10 %) if danger still reads at 4.5:1 on it; else surface | closure and cancellation notice panels |
| success | `--brand-success` | `#1e7f4f`, same stepping as danger | "Open now" |
| successSoft | `--brand-success-soft` | as dangerSoft | reserved |

Typography is not derived: `branding.typography` selects one of five presets in
`src/themes/fonts.ts` (Editorial serif: Source Serif 4 headings with Source Sans 3 text;
Utility sans: Public Sans; Classic serif: Lora with Source Sans 3; Modern grotesk: Inter;
Friendly rounded: Nunito), all self-hosted latin subsets under the SIL Open Font License
(`public/fonts/LICENSE.md`), and themes read only `--font-heading` and `--font-body`. The
`@font-face` rules, each family's metric-adjusted local fallback and the class that sets each
family's variable live in `src/app/globals.css`; the theme root preloads the files of the
preset in use so the first paint already renders with them (decision D-019).

## Design scales (D1)

`siteConfig.design` (Look → Design, organization owners only, audited as `design.updated`)
sets four scales that the theme root exposes as variables (`src/themes/shared/design.ts`).
Themes use the variables, never the option names.

| Option | Values | CSS variable | Used for |
|---|---|---|---|
| `radius` | none 0 px · small 0.25 rem · medium 0.75 rem · large 1.5 rem | `--radius` | images, cards, buttons, fields, panels |
| `density` | per composition, see the theme catalogue below (guide: compact 2.25 rem · regular 3.5 rem · spacious 5 rem; retail: 2 · 3 · 4.5 rem) | `--section-gap` | vertical distance between sections ("regular" is each composition's original rhythm, so earlier releases render unchanged) |
| `density` | compact 2 rem · regular 3 rem · spacious 4.5 rem | `--band-pad` | vertical padding inside coloured bands |
| `container` | narrow 56 rem · regular 72 rem · wide 88 rem | `--container` | page width; "narrow" sections use the reading width (48 rem) regardless, centred on the guide and at the start of the container on the retail composition |

`header`, `hero` and `cards` are compositions, not variables: `default` resolves to the theme's
declared default (`src/themes/capabilities.ts`), and a value the theme does not offer is
rejected on save (`design_unsupported` at publication). Grid sections (feature list,
collections, gallery, facts) take a column count or leave it to the theme (`columnsFor` in
`src/themes/shared/design.ts`: the guide lists collections in three columns and features in
four; the retail composition uses four for both and three for store cards).

## Section bands (D1)

Each page section carries an `appearance.background`. Sections on the page background render
without a band; the other four wrap the section in a full-width band and set the `--section-*`
variables for everything inside, so every pairing inside a band is one the gate already checks
(`on-primary` on `primary`, `on-accent` on `accent`, `on-text` on `text`, `text` and `accent`
on `surface`). The theme root sets the "default" column so components can use the section
variables everywhere.

| Variable | default | tint | primary | accent | dark |
|---|---|---|---|---|---|
| `--section-bg` | background | surface | primary | accent | text |
| `--section-fg` | text | text | onPrimary | onAccent | onText |
| `--section-heading` | primary | primary | onPrimary | onAccent | onText |
| `--section-accent` | accent | accent | onPrimary | onAccent | onText |
| `--section-muted` | muted | muted | onPrimary | onAccent | onText |
| `--section-border` | border | borderStrong | onPrimary at 40 % | onAccent at 40 % | onText at 40 % |
| `--section-panel` / `--section-panel-fg` | surface / text | background / text | background / text | background / text | surface / text |

Buttons and links inside a coloured band invert (the band's "on" colour as background, the band
colour as text), and focus rings inside a band use `--section-fg`. Panels (forms, callouts)
keep the page colours so their fields stay readable on any band.

Text over a hero image (`image_hero` with the `full` style) sits on the text colour mixed over
the picture: `.lw-hero-overlay-light` 55 %, `-medium` 70 %, `-strong` 85 % (`color-mix`), with
`onText` as the text colour. Publication warns (`hero_overlay_light`) when the light overlay is
chosen, because readability then depends on the photograph.

## Theme catalogue (D2)

`design.theme` chooses the composition a site renders with: `default` is the preset's
original composition, or one of the themes written for the preset. `src/themes/capabilities.ts`
declares per theme the presets, the section types and variants, the header, hero and card
styles and their defaults; `src/themes/index.ts` registers the compositions under immutable
keys, and a release renders with the theme it was published with (decision D-018). Every
composition uses this document's vocabulary: brand and section tokens for colour, the design
variables for scale, and its own values for the "regular" rhythm and the theme-default column
counts in `src/themes/shared/design.ts`.

| Theme (key) | Preset | Header styles | Hero styles | `--section-gap` compact / regular / spacious | Theme-default columns: features · collections · stores · gallery · facts |
|---|---|---|---|---|---|
| Community guide (`guide`) | community guide | left*, centered | split*, full, stacked | 2.25 / 3.5 / 5 rem | 4 · 3 · 3 · 3 · 3 |
| Magazine (`magazine`) | community guide | left, centered* | split, full*, stacked | 2.5 / 4 / 5.5 rem | 3 · 3 · 3 · 3 · 4 |
| Location business (`locations`) | location business | left*, centered | full*, stacked | 2 / 3 / 4.5 rem | 4 · 4 · 3 · 3 · 3 |
| Storefront (`storefront`) | location business | left, centered, overlay* | split, full*, stacked | 1.5 / 2.5 / 4 rem | 4 · 3 · 3 · 4 · 4 |
| Almanac (`almanac`, B3) | community guide | left* (navigation rail), centered (top bar) | split, full, stacked* | 2 / 3 / 4.5 rem | 3 · 2 · 2 · 3 · 4 |
| Practice (`practice`, B3) | location business | left*, centered | split*, full, stacked | 2.5 / 4 / 5.5 rem | 3 · 2 · 2 · 3 · 3 |

`*` marks what `default` resolves to. Cards in collections offer image-top, image-side and
text in every theme (the default is image-top on the D2 compositions, image-side on the
almanac and text on the practice); the guide compositions do not render store collections,
and the retail compositions do not offer the editorial "featured item" collection style. The
`overlay` header (storefront only) lays the dark header bar over the opening hero from 768 px.
Where a composition puts the brand on the primary colour or a dark band (the guide and
magazine footers, the storefront header bar) it renders the dark-surface logo
(`branding.logoDarkAssetId`) or the wordmark, never the light-background logo. Since B3 the
theme-default column counts also cover the people and logo strip sections: guide 3 · 4,
magazine 3 · 4, locations 4 · 4, storefront 3 · 4, almanac 3 · 3, practice 3 · 4.

## Photo bands, lightbox and prose blocks (B3)

The photo band (`image_band`) lays a brand colour over its picture with `color-mix`, at the
same three strengths as the hero overlays: `.lw-wash-{primary|accent|dark}-{light|medium|
strong}` at 55 %, 70 % and 85 % of `--brand-primary`, `--brand-accent` or `--brand-text`. The
band sets the `--section-*` variables of the matching tinted band (the table above), so its
text is `onPrimary`, `onAccent` or `onText` and its buttons invert like every band's; a light
wash draws the `band_wash_light` warning at publication, as the light hero overlay does. The
gallery lightbox (`.lw-lightbox`, shown by `:target` alone) sits on `--brand-text` at 92 %
with `--brand-on-text` for the caption, the close link and the next/previous links. The rich
text blocks added in B3 use section tokens only: the divider is a rule on `--section-border`
(each prose family draws it in its own width and weight), the callout a panel on
`--section-panel` with a rule in `--section-accent`, and the button the primary colour with
`onPrimary` text, inverted to `--section-fg` on `--section-bg` inside a band. The rendering
audit below covers all of it unchanged.

## The gate

`brandPairings()` lists every pairing the themes render with its WCAG 2.2 AA minimum
(4.5:1 for text, 3:1 for focus rings and field borders). Publication validation
(`src/server/publishing/validate.ts`) blocks on any failing pairing and names it, with both
colours and the measured ratio; the Look → Brand card shows the same list live. The
pairings:

| Pairing | Minimum |
|---|---|
| text on background; text on surface | 4.5 |
| muted on background | 4.5 |
| primary on background; primary on surface | 4.5 |
| accent on background; accent on surface | 4.5 |
| onPrimary on primary; onAccent on accent; onText on text | 4.5 |
| danger on background; danger on dangerSoft; success on background | 4.5 |
| focus against background | 3 |
| borderStrong against background | 3 |

Derived tokens are built to pass; they fail only when the four inputs leave no readable
option (for example text and background nearly identical), and the message then names the
input pairing to fix.

## Rendering audit

`tests/unit/brand-tokens.test.ts` scans `src/themes/**` and the public part of
`src/app/globals.css`: no hex literals, no Tailwind palette classes (`text-white`,
`bg-gray-100`, …) and no opacity-faded brand colours (`text-(--brand-text)/80`), so a recolour
is complete by construction.

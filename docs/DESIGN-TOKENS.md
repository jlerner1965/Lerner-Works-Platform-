# Design tokens

How a site's four brand colours become every colour the public themes render, and how the
publication gate checks them. Implementation: `src/lib/brand-tokens.ts`; the themes receive
the tokens as CSS custom properties from `src/themes/shared/site-root.tsx`. Introduced in
design programme phase D0 (`docs/DESIGN-PLAN.md`).

## Inputs

`branding.colors`: `primary`, `accent`, `background`, `text` (6-digit hex). Nothing else is
asked of the owner; the derived colours follow the formulas below and cannot be overridden in
D0 (overrides are a D1 option).

## Derived tokens

Mixing is per sRGB channel: `mix(a → b, t) = a + (b − a) · t`, rounded to whole channels.

| Token | CSS variable | Formula | Used for |
|---|---|---|---|
| surface | `--brand-surface` | mix(background → text, 4 %) | forms, callouts, notices, hero placeholders |
| surfaceStrong | `--brand-surface-strong` | mix(background → text, 9 %) | stronger tint (reserved for D1 section backgrounds) |
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

Typography is not derived: `branding.typography` selects a preset in `src/themes/fonts.ts`,
and themes read only `--font-heading` and `--font-body`.

## The gate

`brandPairings()` lists every pairing the themes render with its WCAG 2.2 AA minimum
(4.5:1 for text, 3:1 for focus rings and field borders). Publication validation
(`src/server/publishing/validate.ts`) blocks on any failing pairing and names it, with both
colours and the measured ratio; the Settings → Brand card shows the same list live. The
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

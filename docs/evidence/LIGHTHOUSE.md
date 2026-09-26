# Lighthouse lab runs (local production build)

## After design phase D1 (2026-09-26, evening)

Same tool and conditions as the earlier runs (Lighthouse 13.5.0, Chromium 141 headless,
mobile preset, simulated throttling, three runs per page, `next start` of the production
build on `http://127.0.0.1:3200` with the seeded development database), now against the
re-composed pilots (release 6 of each: full-width retail hero with a focal point, facts,
services as cards, coloured call-to-action bands, quotations band, FAQ, gallery, map link).
Two pages were added to the set because they carry the new section types. Raw per-run
summary: `docs/evidence/lighthouse/d1-2026-09-26-summary.txt`.

| Page | Performance (3 runs) | Median | Accessibility | Best practices | SEO | CLS | LCP (3 runs) | Median LCP |
|---|---|---|---|---|---|---|---|---|
| `/demo/pine-hollow` (guide home) | 96 / 95 / 99 | 96 | 100 | 100 | 66 | 0.025 | 2.73 s / 2.82 s / 2.04 s | 2.73 s |
| `/demo/range-athletics/locations/longmont` (store detail) | 97 / 99 / 97 | 97 | 100 | 100 | 66 | 0.011 | 2.31 s / 1.87 s / 2.30 s | 2.30 s |
| `/demo/range-athletics` (retail home, new full-width hero) | 97 / 99 / 99 | 99 | 100 | 100 | 66 | 0.006 | 2.60 s / 2.06 s / 2.01 s | 2.06 s |
| `/demo/pine-hollow/about` (FAQ and gallery) | 98 / 100 / 96 | 98 | 100 | 100 | 66 | 0.025 | 2.20 s / 1.86 s / 2.69 s | 2.20 s |

Against the targets (median performance ≥ 90, CLS ≤ 0.1, lab LCP ≤ 2.5 s): performance and
CLS met on all four pages; LCP met on three and missed on the guide home by 0.23 s in the
median (runs 2.04–2.82 s, the same band as the M4 and D0 runs; the cause is unchanged: the
simulated first-visit transfer, not the hero image). Accessibility stays at 100 with the
section bands, the native `<details>` accordion and the derived band colours. SEO 66 remains
the intentional `noindex` on demonstration routes.

Public JavaScript budget (DES-14): **143 KiB of script transfer on every measured page,
unchanged from the D0 baseline at kibibyte precision** (allowance 20 KiB per phase). The
pilot pages ship no new page-specific JavaScript: section bands, the accordion and the map
link are plain HTML and CSS. The click-to-load player (`src/themes/shared/video.tsx`) is a
small client component bundled into the public page's client chunk next to the inquiry form,
so it is already inside the 143 KiB measured on every page (the chunk did not grow by a whole
kibibyte). Total first-visit transfer: guide home 314 KiB (document 41, images 31, script 143,
fonts 99: the quotations band now loads the serif italic face, 20 KiB more than at D0), store
detail 226 KiB, retail home 257 KiB (images 49 with the hero), guide about 290 KiB. Every
request is same-origin.

## After design phase D0 (2026-09-26, later the same day)

Same tool and conditions as the M4 runs below (Lighthouse 13.5.0, Chromium 141 headless,
mobile preset, simulated throttling, three runs per page, `next start` of the production
build on `http://127.0.0.1:3200` with the seeded development database, now including the
pilots' generated logos and the guide's share image). Raw per-run summary:
`docs/evidence/lighthouse/d0-2026-09-26-summary.txt`.

| Page | Performance (3 runs) | Median | Accessibility | Best practices | SEO | CLS | LCP (3 runs) | Median LCP |
|---|---|---|---|---|---|---|---|---|
| `/demo/pine-hollow` (guide home) | 94 / 96 / 98 | 96 | 100 | 100 | 66 | 0.026 | 2.88 s / 2.82 s / 2.19 s | 2.82 s |
| `/demo/range-athletics/locations/longmont` (store detail) | 97 / 99 / 99 | 99 | 100 | 100 | 66 | 0.011 | 2.29 s / 1.86 s / 1.87 s | 1.87 s |

Against the targets (median performance ≥ 90, CLS ≤ 0.1, lab LCP ≤ 2.5 s): performance and
CLS met on both pages; LCP met on the store page and missed on the guide home by 0.32 s in
the median (the three runs spread from 2.19 s to 2.88 s, the same band as the M4 runs). The
guide home now also loads the logo (one more image request); accessibility stays at 100 with
the derived colours. SEO 66 remains the intentional `noindex` on demonstration routes.

Public JavaScript budget baseline (DES-14), measured from the Lighthouse network requests on
these runs: **143 KiB of script transfer** on both pages (the client runtime; the pages
themselves ship no page-specific JavaScript beyond the inquiry form). Total first-visit
transfer: guide home 289 KiB (document 36, images 31, script 143, fonts 79), store detail
222 KiB (document 32, images 20, script 143, fonts 27). Every request is same-origin. Later
phases record their script transfer against this baseline; the allowance is 20 KiB per phase
unless a phase records a reason.

## M4 runs (2026-09-26)

Lighthouse 13.5.0 via `pnpm dlx`, Chromium 1194 (`--headless=new`), against
`next start` of the production build on `http://127.0.0.1:3200` with the seeded development
database. Default mobile preset: simulated throttling (RTT 150 ms, 1,638 kbps, 4× CPU
slowdown), emulated 412×823 screen at DPR 1.75. Three runs per page, all reported. These are
lab numbers from one machine, not field data, and say nothing about hosted infrastructure.

| Page | Performance (3 runs) | Median | Accessibility | Best practices | SEO | CLS | LCP (3 runs) | Median LCP |
|---|---|---|---|---|---|---|---|---|
| `/demo/pine-hollow` (guide home) | 96 / 96 / 96 | 96 | 100 | 100 | 66 | 0.026 | 2.72 s / 2.69 s / 2.69 s | 2.69 s |
| `/demo/range-athletics/locations/longmont` (store detail) | 99 / 99 / 99 | 99 | 100 | 100 | 66 | 0.01 | 2.16 s / 1.97 s / 1.95 s | 1.97 s |

Against the guide's project targets (median performance ≥ 90, CLS ≤ 0.1, lab LCP ≤ 2.5 s):
performance and CLS are met on both pages; LCP is met on the store page and missed by
0.19 s on the guide home. The guide home's LCP element is the hero image (8 KiB, `fetchpriority=high`,
discoverable in the HTML); in the simulated model its time is set by the total first-visit
transfer (275 KiB: ~140 KiB client runtime, 78 KiB of the two guide fonts, the rest images) over
a 1.6 Mbps link with 150 ms round trips rather than by the image itself. SEO 66 on both pages is
only the `is-crawlable` audit: demonstration routes are deliberately `noindex`; a live domain
serves `index, follow` (see `tests/e2e/routing.spec.ts`).

Changes made after a first measurement (same conditions): fonts are no longer preloaded, so
retailer pages stop downloading the guide's serif (store page LCP 3.02 s → 1.97 s, performance
94 → 99); the two small stylesheets are inlined (`experimental.inlineCss`); two muted text
colors on the guide were raised to 4.5:1 contrast (accessibility 96 → 100). CLS moved from 0
to 0.026 / 0.01 with the font swap and stays far below 0.1.

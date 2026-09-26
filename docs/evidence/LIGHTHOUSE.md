# Lighthouse lab runs (local production build, 2026-09-26)

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

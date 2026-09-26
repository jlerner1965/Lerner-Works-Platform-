import localFont from "next/font/local";

/**
 * Self-hosted open-licensed typefaces (SIL Open Font License 1.1; see fonts/LICENSE.md).
 * Files are the Google Fonts latin subsets; variable-weight files cover the listed range.
 *
 * Fonts are not preloaded: both themes are part of the same public route, and a preload would
 * make every page download all three families (the retailer pages never use the serif).
 * Each theme's stylesheet references only its own faces, so the browser fetches them on
 * first use; metric-adjusted fallbacks keep the swap from shifting layout.
 */
export const guideSerif = localFont({
  src: [
    { path: "./fonts/source-serif-4-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/source-serif-4-normal.woff2", weight: "400 700", style: "normal" },
  ],
  variable: "--font-guide-serif",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
});

export const guideSans = localFont({
  src: [
    { path: "./fonts/source-sans-3-normal.woff2", weight: "400 600", style: "normal" },
  ],
  variable: "--font-guide-sans",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
});

export const locationsSans = localFont({
  src: [
    { path: "./fonts/public-sans-normal.woff2", weight: "400 800", style: "normal" },
  ],
  variable: "--font-locations-sans",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
});

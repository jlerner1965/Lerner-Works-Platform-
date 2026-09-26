import localFont from "next/font/local";

/**
 * Self-hosted open-licensed typefaces (SIL Open Font License 1.1; see fonts/LICENSE.md).
 * Files are the Google Fonts latin subsets; variable-weight files cover the listed range.
 */
export const guideSerif = localFont({
  src: [
    { path: "./fonts/source-serif-4-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/source-serif-4-normal.woff2", weight: "400 700", style: "normal" },
  ],
  variable: "--font-guide-serif",
  display: "swap",
  preload: true,
});

export const guideSans = localFont({
  src: [
    { path: "./fonts/source-sans-3-normal.woff2", weight: "400 600", style: "normal" },
  ],
  variable: "--font-guide-sans",
  display: "swap",
  preload: true,
});

export const locationsSans = localFont({
  src: [
    { path: "./fonts/public-sans-normal.woff2", weight: "400 800", style: "normal" },
  ],
  variable: "--font-locations-sans",
  display: "swap",
  preload: true,
});

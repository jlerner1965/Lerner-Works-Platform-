import localFont from "next/font/local";
import type { TypographyPresetKey } from "@/modules/site-config";

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

export interface TypographyPreset {
  key: TypographyPresetKey;
  label: string;
  description: string;
  /** Font-variable classes to put on the theme root (each defines its CSS variable there). */
  classNames: string;
  /** CSS custom property names that hold each family's font stack. */
  headingVariable: string;
  bodyVariable: string;
}

/**
 * Typography presets a site can choose from (`branding.typography`). Themes read
 * `--font-heading` and `--font-body` only, so a preset swap changes every heading and body
 * face without touching theme code. Both presets use the self-hosted families above.
 */
export const typographyPresets: Record<TypographyPresetKey, TypographyPreset> = {
  "editorial-serif": {
    key: "editorial-serif",
    label: "Editorial serif",
    description: "Source Serif 4 headings with Source Sans 3 text.",
    classNames: `${guideSerif.variable} ${guideSans.variable}`,
    headingVariable: "--font-guide-serif",
    bodyVariable: "--font-guide-sans",
  },
  "utility-sans": {
    key: "utility-sans",
    label: "Utility sans",
    description: "Public Sans for headings and text.",
    classNames: locationsSans.variable,
    headingVariable: "--font-locations-sans",
    bodyVariable: "--font-locations-sans",
  },
};

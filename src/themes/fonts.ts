import type { TypographyPresetKey } from "@/modules/site-config";

/**
 * Self-hosted open-licensed typefaces (SIL Open Font License 1.1; see public/fonts/LICENSE.md).
 * The files are the Google Fonts latin subsets, served from `public/fonts/` with a long cache
 * life (`next.config.ts`); the `@font-face` rules and the metric-adjusted local fallback of
 * each family live in `src/app/globals.css` (decision D-019). A family declares the CSS
 * variable that carries its stack and the class that sets it; a typography preset puts its
 * families' classes on the theme root, which also preloads the preset's files so the first
 * paint already has them and the swap from the fallback face moves nothing.
 */
export interface FontFamily {
  /** Class defined in globals.css that sets `variable` to the family's stack. */
  className: string;
  /** CSS custom property that holds the family's font stack. */
  variable: string;
  /** Files under public/, preloaded by the theme root while the family is in use. */
  files: string[];
}

export const guideSerif: FontFamily = {
  className: "lw-font-guide-serif",
  variable: "--font-guide-serif",
  files: ["/fonts/source-serif-4-normal.woff2", "/fonts/source-serif-4-400-italic.woff2"],
};
export const guideSans: FontFamily = {
  className: "lw-font-guide-sans",
  variable: "--font-guide-sans",
  files: ["/fonts/source-sans-3-normal.woff2"],
};
export const locationsSans: FontFamily = {
  className: "lw-font-locations-sans",
  variable: "--font-locations-sans",
  files: ["/fonts/public-sans-normal.woff2"],
};
// Families added for the D2 presets (latin subsets, variable weight).
export const lora: FontFamily = {
  className: "lw-font-lora",
  variable: "--font-lora",
  files: ["/fonts/lora-normal.woff2", "/fonts/lora-400-italic.woff2"],
};
export const inter: FontFamily = {
  className: "lw-font-inter",
  variable: "--font-inter",
  files: ["/fonts/inter-normal.woff2"],
};
export const nunito: FontFamily = {
  className: "lw-font-nunito",
  variable: "--font-nunito",
  files: ["/fonts/nunito-normal.woff2"],
};

export interface TypographyPreset {
  key: TypographyPresetKey;
  label: string;
  description: string;
  /** Classes to put on the theme root (each defines its family's CSS variable there). */
  classNames: string;
  /** CSS custom property names that hold each family's font stack. */
  headingVariable: string;
  bodyVariable: string;
  /** Font files the theme root preloads for this preset. */
  preload: string[];
}

function preset(key: TypographyPresetKey, label: string, description: string, heading: FontFamily, body: FontFamily): TypographyPreset {
  const families = heading === body ? [heading] : [heading, body];
  return {
    key,
    label,
    description,
    classNames: families.map((f) => f.className).join(" "),
    headingVariable: heading.variable,
    bodyVariable: body.variable,
    preload: families.flatMap((f) => f.files),
  };
}

/**
 * Typography presets a site can choose from (`branding.typography`). Themes read
 * `--font-heading` and `--font-body` only, so a preset swap changes every heading and body
 * face without touching theme code. Every preset uses the self-hosted families above.
 */
export const typographyPresets: Record<TypographyPresetKey, TypographyPreset> = {
  "editorial-serif": preset("editorial-serif", "Editorial serif", "Source Serif 4 headings with Source Sans 3 text.", guideSerif, guideSans),
  "utility-sans": preset("utility-sans", "Utility sans", "Public Sans for headings and text.", locationsSans, locationsSans),
  "classic-serif": preset("classic-serif", "Classic serif", "Lora headings with Source Sans 3 text.", lora, guideSans),
  "modern-grotesk": preset("modern-grotesk", "Modern grotesk", "Inter for headings and text.", inter, inter),
  "friendly-rounded": preset("friendly-rounded", "Friendly rounded", "Nunito for headings and text.", nunito, nunito),
};

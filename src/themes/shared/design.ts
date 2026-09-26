import type { CSSProperties } from "react";
import type { SiteDesign } from "@/modules/site-config";
import type { SectionAppearance, SectionBackground } from "@/modules/page";
import { brandCssVariables, deriveBrandTokens, type BrandTokens } from "@/lib/brand-tokens";
import type { RenderContext } from "@/themes/shared/types";
import { resolveDesign, themeKeyFor, type ThemeKey } from "@/themes/capabilities";

/**
 * Site-level design options as CSS custom properties (design programme D1). Themes use the
 * variables, never the option names: `--radius` on images, cards, buttons and fields;
 * `--section-gap` between sections; `--band-pad` inside coloured bands; `--container` for
 * the page width. The `--section-*` variables describe the colours inside the current
 * section band and default to the page colours on the theme root (see `bandVariables`).
 */
const radius: Record<SiteDesign["radius"], string> = { none: "0px", small: "0.25rem", medium: "0.75rem", large: "1.5rem" };
/** Vertical rhythm per theme: "regular" is each composition's original spacing (guide 3.5 rem, retail 3 rem), so releases published before D1 render as they did. */
const sectionGap: Record<ThemeKey, Record<SiteDesign["density"], string>> = {
  guide: { compact: "2.25rem", regular: "3.5rem", spacious: "5rem" },
  locations: { compact: "2rem", regular: "3rem", spacious: "4.5rem" },
  magazine: { compact: "2.5rem", regular: "4rem", spacious: "5.5rem" },
  storefront: { compact: "1.5rem", regular: "2.5rem", spacious: "4rem" },
};
const bandPad: Record<SiteDesign["density"], string> = { compact: "2rem", regular: "3rem", spacious: "4.5rem" };
const container: Record<SiteDesign["container"], string> = { narrow: "56rem", regular: "72rem", wide: "88rem" };

export type ColumnSection = "feature_list" | "content_collection" | "category_list" | "location_collection" | "gallery" | "facts";
/** Column counts a theme uses when a section leaves `columns` unset: each composition's original grids. */
const defaultColumns: Record<ThemeKey, Record<ColumnSection, 2 | 3 | 4>> = {
  guide: { feature_list: 4, content_collection: 3, category_list: 4, location_collection: 3, gallery: 3, facts: 3 },
  locations: { feature_list: 4, content_collection: 4, category_list: 4, location_collection: 3, gallery: 3, facts: 3 },
  magazine: { feature_list: 3, content_collection: 3, category_list: 3, location_collection: 3, gallery: 3, facts: 4 },
  storefront: { feature_list: 4, content_collection: 3, category_list: 4, location_collection: 3, gallery: 4, facts: 4 },
};

export function columnsFor(theme: ThemeKey, type: ColumnSection, columns: 2 | 3 | 4 | undefined): 2 | 3 | 4 {
  return columns ?? defaultColumns[theme][type];
}

export function brandTokensFor(ctx: RenderContext): BrandTokens {
  const { branding, design } = ctx.snapshot.config;
  return deriveBrandTokens(branding.colors, design?.overrides ?? {});
}

/** Every variable the theme root sets: brand tokens, design scales and the default section colours. */
export function rootVariables(ctx: RenderContext): CSSProperties {
  const design = ctx.snapshot.config.design;
  return {
    ...brandCssVariables(brandTokensFor(ctx)),
    "--radius": radius[design.radius],
    "--section-gap": sectionGap[themeKeyOf(ctx)][design.density],
    "--band-pad": bandPad[design.density],
    "--container": container[design.container],
    ...bandVariables("default"),
  } as CSSProperties;
}

export function themeKeyOf(ctx: RenderContext): ThemeKey {
  return themeKeyFor(ctx.snapshot.site.preset, ctx.snapshot.config.design);
}

/** Concrete header, hero and card styles for this site (theme defaults applied). */
export function siteDesign(ctx: RenderContext): ReturnType<typeof resolveDesign> & { radius: SiteDesign["radius"]; density: SiteDesign["density"]; container: SiteDesign["container"] } {
  const design = ctx.snapshot.config.design;
  return { ...resolveDesign(themeKeyOf(ctx), design), radius: design.radius, density: design.density, container: design.container };
}

/**
 * Colours inside a section band. Text on coloured bands uses the band's "on" colour, so every
 * pairing is one the contrast gate checks (on-primary/primary, on-accent/accent, on-text/text,
 * text and accent on surface). Panels inside a band (forms, callouts) keep the page colours.
 */
export function bandVariables(background: SectionBackground): Record<string, string> {
  switch (background) {
    case "tint":
      return vars({ bg: "var(--brand-surface)", fg: "var(--brand-text)", heading: "var(--brand-primary)", accent: "var(--brand-accent)", muted: "var(--brand-muted)", border: "var(--brand-border-strong)", panel: "var(--brand-bg)", panelFg: "var(--brand-text)" });
    case "primary":
      return vars({ bg: "var(--brand-primary)", fg: "var(--brand-on-primary)", heading: "var(--brand-on-primary)", accent: "var(--brand-on-primary)", muted: "var(--brand-on-primary)", border: "color-mix(in srgb, var(--brand-on-primary) 40%, transparent)", panel: "var(--brand-bg)", panelFg: "var(--brand-text)" });
    case "accent":
      return vars({ bg: "var(--brand-accent)", fg: "var(--brand-on-accent)", heading: "var(--brand-on-accent)", accent: "var(--brand-on-accent)", muted: "var(--brand-on-accent)", border: "color-mix(in srgb, var(--brand-on-accent) 40%, transparent)", panel: "var(--brand-bg)", panelFg: "var(--brand-text)" });
    case "dark":
      return vars({ bg: "var(--brand-text)", fg: "var(--brand-on-text)", heading: "var(--brand-on-text)", accent: "var(--brand-on-text)", muted: "var(--brand-on-text)", border: "color-mix(in srgb, var(--brand-on-text) 40%, transparent)", panel: "var(--brand-surface)", panelFg: "var(--brand-text)" });
    default:
      return vars({ bg: "var(--brand-bg)", fg: "var(--brand-text)", heading: "var(--brand-primary)", accent: "var(--brand-accent)", muted: "var(--brand-muted)", border: "var(--brand-border)", panel: "var(--brand-surface)", panelFg: "var(--brand-text)" });
  }
}

function vars(v: { bg: string; fg: string; heading: string; accent: string; muted: string; border: string; panel: string; panelFg: string }): Record<string, string> {
  return {
    "--section-bg": v.bg,
    "--section-fg": v.fg,
    "--section-heading": v.heading,
    "--section-accent": v.accent,
    "--section-muted": v.muted,
    "--section-border": v.border,
    "--section-panel": v.panel,
    "--section-panel-fg": v.panelFg,
  };
}

/** Whether a band's text colours are the "on" colours (buttons and links must invert). */
export function isColouredBand(background: SectionBackground): boolean {
  return background === "primary" || background === "accent" || background === "dark";
}

export function contentWidthClass(appearance: SectionAppearance, narrowByDefault = false): string {
  if (appearance.width === "narrow") return "max-w-3xl";
  if (appearance.width === "wide") return "max-w-(--container)";
  return narrowByDefault ? "max-w-3xl" : "max-w-(--container)";
}

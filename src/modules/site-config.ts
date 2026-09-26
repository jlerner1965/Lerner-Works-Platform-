import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color such as #1f5fbf.");
/** A site-relative path or a full https:// address (external links get rel="noreferrer"). */
const linkTarget = z
  .string()
  .trim()
  .max(300)
  .regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, "Use a site-relative path such as /about or a full https:// address.");
/** BCP 47 language tag such as en, es or pt-BR. */
const languageTag = z.string().trim().regex(/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/, "Use a language tag such as en, es or pt-BR.");

export const navigationItemSchema = z.object({
  label: z.string().trim().min(1).max(40),
  path: linkTarget,
});

/** Owner-written title and introduction for a module's listing page; empty means the theme's default. */
export const indexCopySchema = z
  .object({
    title: z.string().trim().max(80).default(""),
    intro: z.string().trim().max(400).default(""),
  })
  .default({ title: "", intro: "" });

export const footerVariants = ["columns", "compact"] as const;
export const typographyPresetKeys = ["editorial-serif", "utility-sans"] as const;

const hexOrAuto = z.union([z.literal(""), hexColor]).default("");
export const headerStyles = ["default", "left", "centered"] as const;
export const heroStyles = ["default", "split", "full", "stacked"] as const;
export const cardStyles = ["default", "image-top", "image-side", "text"] as const;
export const radiusScales = ["none", "small", "medium", "large"] as const;
export const densities = ["compact", "regular", "spacious"] as const;
export const containerWidths = ["narrow", "regular", "wide"] as const;
export const tokenOverrideKeys = ["surface", "surfaceStrong", "muted", "border", "borderStrong", "focus"] as const;

/**
 * Site-level design options (design programme D1). "default" resolves through the theme's
 * declared defaults (`src/themes/capabilities.ts`); the remaining scales map to CSS
 * variables set on the theme root. Token overrides replace a derived colour with an owner
 * choice; the contrast gate runs on the final values.
 */
export const designSchema = z
  .object({
    header: z.enum(headerStyles).default("default"),
    hero: z.enum(heroStyles).default("default"),
    cards: z.enum(cardStyles).default("default"),
    radius: z.enum(radiusScales).default("none"),
    density: z.enum(densities).default("regular"),
    container: z.enum(containerWidths).default("regular"),
    overrides: z
      .object({
        surface: hexOrAuto,
        surfaceStrong: hexOrAuto,
        muted: hexOrAuto,
        border: hexOrAuto,
        borderStrong: hexOrAuto,
        focus: hexOrAuto,
      })
      .prefault({}),
  })
  .prefault({});

export const siteConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  branding: z.object({
    wordmark: z.string().trim().min(1).max(60),
    tagline: z.string().trim().max(120).default(""),
    logoAssetId: z.uuid().nullable().default(null),
    colors: z.object({
      primary: hexColor,
      accent: hexColor,
      background: hexColor,
      text: hexColor,
    }),
    typography: z.enum(typographyPresetKeys),
  }),
  navigation: z.object({
    items: z.array(navigationItemSchema).max(8).default([]),
    showSearch: z.boolean().default(true),
  }),
  footer: z.object({
    text: z.string().trim().max(400).default(""),
    links: z.array(navigationItemSchema).max(8).default([]),
    showContactDetails: z.boolean().default(true),
    variant: z.enum(footerVariants).default("columns"),
  }),
  modules: z.object({
    places: z.boolean().default(false),
    events: z.boolean().default(false),
    articles: z.boolean().default(false),
    stores: z.boolean().default(false),
    services: z.boolean().default(false),
    inquiries: z.boolean().default(true),
  }),
  indexes: z
    .object({
      places: indexCopySchema,
      events: indexCopySchema,
      articles: indexCopySchema,
      stores: indexCopySchema,
      services: indexCopySchema,
    })
    .prefault({}),
  metadata: z.object({
    defaultTitle: z.string().trim().min(1).max(70),
    titleSuffix: z.string().trim().max(40).default(""),
    defaultDescription: z.string().trim().max(200).default(""),
    language: languageTag.default("en"),
    faviconAssetId: z.uuid().nullable().default(null),
    shareImageAssetId: z.uuid().nullable().default(null),
  }),
  design: designSchema,
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
/** Configuration as written by presets and forms, before defaults are applied. */
export type SiteConfigInput = z.input<typeof siteConfigSchema>;
export type ModuleKey = keyof SiteConfig["modules"];
export type IndexModuleKey = keyof SiteConfig["indexes"];
export type FooterVariant = SiteConfig["footer"]["variant"];
export type TypographyPresetKey = SiteConfig["branding"]["typography"];
export type SiteDesign = SiteConfig["design"];
export type TokenOverrideKey = (typeof tokenOverrideKeys)[number];

export function isExternalLink(path: string): boolean {
  return /^https:\/\//i.test(path);
}

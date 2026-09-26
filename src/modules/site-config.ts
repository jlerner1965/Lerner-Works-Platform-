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
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
/** Configuration as written by presets and forms, before defaults are applied. */
export type SiteConfigInput = z.input<typeof siteConfigSchema>;
export type ModuleKey = keyof SiteConfig["modules"];
export type IndexModuleKey = keyof SiteConfig["indexes"];
export type FooterVariant = SiteConfig["footer"]["variant"];
export type TypographyPresetKey = SiteConfig["branding"]["typography"];

export function isExternalLink(path: string): boolean {
  return /^https:\/\//i.test(path);
}

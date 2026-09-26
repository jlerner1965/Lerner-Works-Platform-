import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color such as #1f5fbf.");
const sitePath = z.string().regex(/^\/[^\s]*$/, "Use a site-relative path such as /about.");

export const navigationItemSchema = z.object({
  label: z.string().trim().min(1).max(40),
  path: sitePath,
});

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
    typography: z.enum(["editorial-serif", "utility-sans"]),
  }),
  navigation: z.object({
    items: z.array(navigationItemSchema).max(8).default([]),
  }),
  footer: z.object({
    text: z.string().trim().max(400).default(""),
    links: z.array(navigationItemSchema).max(8).default([]),
    showContactDetails: z.boolean().default(true),
  }),
  modules: z.object({
    places: z.boolean().default(false),
    events: z.boolean().default(false),
    articles: z.boolean().default(false),
    stores: z.boolean().default(false),
    services: z.boolean().default(false),
    inquiries: z.boolean().default(true),
  }),
  metadata: z.object({
    defaultTitle: z.string().trim().min(1).max(70),
    titleSuffix: z.string().trim().max(40).default(""),
    defaultDescription: z.string().trim().max(200).default(""),
  }),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type ModuleKey = keyof SiteConfig["modules"];

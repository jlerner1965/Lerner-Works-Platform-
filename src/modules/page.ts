import { z } from "zod";
import { bodySchema } from "@/lib/richtext";
import { commonFields, addressSchema } from "@/modules/common";

/**
 * Page sections: fixed vocabularies validated on write and again before publication
 * (design programme principle 1). Every section carries a `variant` (its composition,
 * "default" meaning the site's or theme's default) and an `appearance` (background band,
 * alignment, width). Which variants a theme supports is declared in
 * `src/themes/capabilities.ts` and checked on save, on import and at publication.
 */
const sectionBase = { id: z.string().min(1).max(64) };
const internalPath = z.union([z.literal(""), z.string().regex(/^\/[^\s]*$/, "Use a site-relative path such as /contact.")]).default("");
/** Site-relative path or full https:// address (external links are rendered without a referrer). */
const linkTarget = z
  .union([z.literal(""), z.string().trim().max(300).regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, "Use a site-relative path such as /contact or a full https:// address.")])
  .default("");
/** Grid columns of a section; unset means the theme's own column count for that section type (`columnsFor`). */
const columns = z.union([z.literal(2), z.literal(3), z.literal(4)]);

export const sectionBackgrounds = ["default", "tint", "primary", "accent", "dark"] as const;
export const sectionAligns = ["start", "center"] as const;
export const sectionWidths = ["default", "narrow", "wide"] as const;
export type SectionBackground = (typeof sectionBackgrounds)[number];

export const appearanceSchema = z
  .object({
    background: z.enum(sectionBackgrounds).default("default"),
    align: z.enum(sectionAligns).default("start"),
    width: z.enum(sectionWidths).default("default"),
  })
  .prefault({});
export type SectionAppearance = z.infer<typeof appearanceSchema>;

/** Variant vocabularies per section type; "default" always resolves through the theme. */
export const sectionVariants = {
  text_hero: ["default", "compact", "statement"],
  image_hero: ["default", "split", "full", "stacked"],
  rich_text: ["default", "columns", "lead"],
  feature_list: ["default", "grid", "list", "cards"],
  content_collection: ["default", "cards", "list", "text", "featured"],
  location_collection: ["default", "cards", "list", "featured"],
  contact_callout: ["default", "banner", "split"],
  inquiry_form: ["default", "wide"],
  faq: ["default", "accordion", "open"],
  quotes: ["default", "single", "grid"],
  cta_banner: ["default", "centered", "split"],
  gallery: ["default", "grid", "columns", "strip"],
  facts: ["default", "grid", "list", "inline"],
  video: ["default", "wide"],
  map_link: ["default", "card"],
} as const;

const variantOf = <T extends keyof typeof sectionVariants>(type: T) => z.enum(sectionVariants[type]).default("default");

const galleryAspects = ["landscape", "square", "portrait", "natural"] as const;
export const videoProviders = ["youtube", "vimeo"] as const;
export const mapProviders = ["google", "apple", "openstreetmap"] as const;
export const videoIdPatterns: Record<(typeof videoProviders)[number], RegExp> = {
  youtube: /^[A-Za-z0-9_-]{11}$/,
  vimeo: /^\d{6,12}$/,
};

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    ...sectionBase,
    type: z.literal("text_hero"),
    variant: variantOf("text_hero"),
    appearance: appearanceSchema,
    heading: z.string().trim().min(1).max(160),
    subheading: z.string().trim().max(400).default(""),
    ctaLabel: z.string().trim().max(60).default(""),
    ctaPath: internalPath,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("image_hero"),
    variant: variantOf("image_hero"),
    appearance: appearanceSchema,
    heading: z.string().trim().min(1).max(160),
    subheading: z.string().trim().max(400).default(""),
    imageAssetId: z.uuid().nullable().default(null),
    /** Darkening over the image when the text sits on it (full variant). */
    overlay: z.enum(["light", "medium", "strong"]).default("medium"),
    ctaLabel: z.string().trim().max(60).default(""),
    ctaPath: internalPath,
  }),
  z.object({ ...sectionBase, type: z.literal("rich_text"), variant: variantOf("rich_text"), appearance: appearanceSchema, heading: z.string().trim().max(160).default(""), body: bodySchema.default([]) }),
  z.object({
    ...sectionBase,
    type: z.literal("feature_list"),
    variant: variantOf("feature_list"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    columns: columns.optional(),
    items: z
      .array(z.object({ title: z.string().trim().min(1).max(120), text: z.string().trim().max(400).default(""), path: internalPath }))
      .max(12)
      .default([]),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("content_collection"),
    variant: variantOf("content_collection"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    kind: z.enum(["place", "event", "article", "service"]),
    mode: z.enum(["selected", "latest", "upcoming"]).default("latest"),
    itemIds: z.array(z.uuid()).max(24).default([]),
    limit: z.number().int().min(1).max(24).default(6),
    columns: columns.optional(),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("location_collection"),
    variant: variantOf("location_collection"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    mode: z.enum(["selected", "all"]).default("all"),
    itemIds: z.array(z.uuid()).max(24).default([]),
    columns: columns.optional(),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("contact_callout"),
    variant: variantOf("contact_callout"),
    appearance: appearanceSchema,
    heading: z.string().trim().min(1).max(160),
    text: z.string().trim().max(600).default(""),
    showContactDetails: z.boolean().default(true),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("inquiry_form"),
    variant: variantOf("inquiry_form"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default("Send an inquiry"),
    intro: z.string().trim().max(600).default(""),
    locationSelect: z.boolean().default(false),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("faq"),
    variant: variantOf("faq"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    items: z.array(z.object({ question: z.string().trim().min(1, "Enter the question.").max(200), answer: bodySchema.default([]) })).max(30).default([]),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("quotes"),
    variant: variantOf("quotes"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    items: z
      .array(z.object({ text: z.string().trim().min(1, "Enter the quotation.").max(600), attribution: z.string().trim().min(1, "Say who said it.").max(120), role: z.string().trim().max(120).default("") }))
      .max(12)
      .default([]),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("cta_banner"),
    variant: variantOf("cta_banner"),
    appearance: appearanceSchema,
    heading: z.string().trim().min(1).max(160),
    text: z.string().trim().max(400).default(""),
    ctaLabel: z.string().trim().max(60).default(""),
    ctaPath: linkTarget,
    secondaryLabel: z.string().trim().max(60).default(""),
    secondaryPath: linkTarget,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("gallery"),
    variant: variantOf("gallery"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    columns: columns.optional(),
    aspect: z.enum(galleryAspects).default("landscape"),
    items: z.array(z.object({ assetId: z.uuid(), caption: z.string().trim().max(300).default("") })).max(24).default([]),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("facts"),
    variant: variantOf("facts"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    columns: columns.optional(),
    items: z.array(z.object({ label: z.string().trim().min(1, "Enter the label.").max(80), value: z.string().trim().min(1, "Enter the value.").max(200) })).max(24).default([]),
  }),
  z
    .object({
      ...sectionBase,
      type: z.literal("video"),
      variant: variantOf("video"),
      appearance: appearanceSchema,
      heading: z.string().trim().max(160).default(""),
      /** Accessible name of the player and the poster's caption; required at publication. */
      title: z.string().trim().max(160).default(""),
      provider: z.enum(videoProviders).default("youtube"),
      videoId: z.string().trim().max(40).default(""),
      posterAssetId: z.uuid().nullable().default(null),
      caption: z.string().trim().max(300).default(""),
    })
    .superRefine((v, ctx) => {
      if (v.videoId && !videoIdPatterns[v.provider].test(v.videoId)) {
        ctx.addIssue({ code: "custom", path: ["videoId"], message: v.provider === "youtube" ? "A YouTube video id is the 11 characters after v= in the video's address." : "A Vimeo video id is the number at the end of the video's address." });
      }
    }),
  z.object({
    ...sectionBase,
    type: z.literal("map_link"),
    variant: variantOf("map_link"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    text: z.string().trim().max(400).default(""),
    label: z.string().trim().max(60).default("Get directions"),
    provider: z.enum(mapProviders).default("google"),
    address: addressSchema.prefault({}),
  }),
]);

export type PageSection = z.infer<typeof sectionSchema>;
export type SectionType = PageSection["type"];
export type SectionVariant<T extends SectionType> = (typeof sectionVariants)[T][number];

export const sectionTypeLabels: Record<SectionType, string> = {
  text_hero: "Text hero",
  image_hero: "Image hero",
  rich_text: "Rich text",
  feature_list: "Feature list",
  content_collection: "Content collection",
  location_collection: "Location collection",
  contact_callout: "Contact callout",
  inquiry_form: "Inquiry form",
  faq: "Questions and answers",
  quotes: "Quotes",
  cta_banner: "Call to action",
  gallery: "Gallery",
  facts: "Facts",
  video: "Video (click to play)",
  map_link: "Map link",
};

/** Owner-facing names for variants; "default" reads as "Site default". */
export const variantLabels: Record<string, string> = {
  default: "Site default",
  compact: "Compact",
  statement: "Statement (very large)",
  split: "Split: text beside the image",
  full: "Full-width image with text over it",
  stacked: "Image above the text",
  columns: "Two columns",
  lead: "Lead paragraph",
  grid: "Grid",
  list: "List",
  cards: "Cards",
  text: "Text only",
  featured: "Featured item and list",
  banner: "Banner",
  wide: "Wide",
  accordion: "Expandable questions",
  open: "All answers shown",
  single: "One large quotation",
  centered: "Centred",
  strip: "Horizontal strip",
  inline: "Inline",
  card: "Card",
};

export const backgroundLabels: Record<SectionBackground, string> = {
  default: "Page background",
  tint: "Tinted band",
  primary: "Primary colour band",
  accent: "Accent colour band",
  dark: "Text-coloured band",
};

export const pagePayloadSchema = z.object({
  ...commonFields,
  sections: z.array(sectionSchema).max(30).default([]),
});
export type PagePayload = z.infer<typeof pagePayloadSchema>;
/** A page as written by presets and fixtures, before defaults (variant, appearance, columns) are applied. */
export type PagePayloadInput = z.input<typeof pagePayloadSchema>;
export type PageSectionInput = z.input<typeof sectionSchema>;

/** A new section of a type with every default applied (for the editor's "Add section"). */
export function emptySection(type: SectionType, id: string): PageSection {
  const seeds: Record<SectionType, Record<string, unknown>> = {
    text_hero: { heading: "Heading" },
    image_hero: { heading: "Heading" },
    rich_text: {},
    feature_list: {},
    content_collection: { kind: "place" },
    location_collection: {},
    contact_callout: { heading: "Get in touch" },
    inquiry_form: {},
    faq: {},
    quotes: {},
    cta_banner: { heading: "Ready when you are", appearance: { background: "primary", align: "center" } },
    gallery: {},
    facts: {},
    video: {},
    map_link: {},
  };
  return sectionSchema.parse({ id, type, ...seeds[type] });
}

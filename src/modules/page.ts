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

/**
 * Variant vocabularies per section type; "default" always resolves through the theme. The
 * site-building programme's phase B3 added the hero treatments `offset` (the words overlap the
 * picture), `collage` (the picture with up to three more) and `statement` (oversized heading,
 * picture beneath), and the section types team, logo_strip, image_text and image_band.
 */
export const sectionVariants = {
  text_hero: ["default", "compact", "statement"],
  image_hero: ["default", "split", "full", "stacked", "offset", "collage", "statement"],
  rich_text: ["default", "columns", "lead"],
  feature_list: ["default", "grid", "list", "cards"],
  content_collection: ["default", "cards", "list", "text", "featured"],
  category_list: ["default", "chips", "grid", "list"],
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
  team: ["default", "grid", "list", "compact"],
  logo_strip: ["default", "row", "grid", "mono"],
  image_text: ["default", "alternating", "image_left", "image_right"],
  image_band: ["default", "compact", "tall"],
} as const;

const variantOf = <T extends keyof typeof sectionVariants>(type: T) => z.enum(sectionVariants[type]).default("default");

const galleryAspects = ["landscape", "square", "portrait", "natural"] as const;
export const videoProviders = ["youtube", "vimeo"] as const;
export const mapProviders = ["google", "apple", "openstreetmap"] as const;
/** Providers with a keyless embeddable map (Apple Maps has none; it stays a link). */
export const mapEmbedProviders: ReadonlyArray<(typeof mapProviders)[number]> = ["google", "openstreetmap"];
export const videoIdPatterns: Record<(typeof videoProviders)[number], RegExp> = {
  youtube: /^[A-Za-z0-9_-]{11}$/,
  vimeo: /^\d{6,12}$/,
};
/** The colour washed over a photo band and how strong it is (B3). */
export const bandTints = ["primary", "accent", "dark"] as const;
export const bandStrengths = ["light", "medium", "strong"] as const;
export type BandTint = (typeof bandTints)[number];
const latitude = z.number().min(-90).max(90).nullable().default(null);
const longitude = z.number().min(-180).max(180).nullable().default(null);

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
    /** Up to three more pictures for the collage treatment (B3); other treatments ignore them. */
    extraImageAssetIds: z.array(z.uuid()).max(3).default([]),
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
  /**
   * The categories of the published places, each linking to the filtered directory, with the
   * number of places in it. Fills itself from the release (site-building programme B2): a
   * fresh site's home page needs no hand-written category list.
   */
  z.object({
    ...sectionBase,
    type: z.literal("category_list"),
    variant: variantOf("category_list"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    limit: z.number().int().min(1).max(24).default(12),
    showCounts: z.boolean().default(true),
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
      .array(
        z.object({
          text: z.string().trim().min(1, "Enter the quotation.").max(600),
          attribution: z.string().trim().min(1, "Say who said it.").max(120),
          role: z.string().trim().max(120).default(""),
          /** Portrait of the person quoted (B3); shown beside the attribution. */
          assetId: z.uuid().nullable().default(null),
        }),
      )
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
    /** Each picture opens at full size in a lightbox drawn with CSS alone (B3; no script). */
    lightbox: z.boolean().default(false),
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
    /**
     * Click-to-load map (B3, decision D-013 extended): the page shows the address on a plain
     * panel and loads the provider's map only when the visitor asks for it. Needs coordinates
     * and a provider with a keyless embed; the address approval rule still applies.
     */
    embed: z.boolean().default(false),
    latitude,
    longitude,
  }),
  /**
   * People (B3): a portrait, name, role and a few words each, optionally linking to a page.
   */
  z.object({
    ...sectionBase,
    type: z.literal("team"),
    variant: variantOf("team"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    intro: z.string().trim().max(600).default(""),
    columns: columns.optional(),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Enter the person's name.").max(120),
          role: z.string().trim().max(120).default(""),
          text: z.string().trim().max(600).default(""),
          assetId: z.uuid().nullable().default(null),
          path: linkTarget,
        }),
      )
      .max(24)
      .default([]),
  }),
  /**
   * Logo strip (B3): partner, member or press logos in a row, each an uploaded image with its
   * own alternative text, optionally linking out.
   */
  z.object({
    ...sectionBase,
    type: z.literal("logo_strip"),
    variant: variantOf("logo_strip"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    columns: columns.optional(),
    items: z.array(z.object({ assetId: z.uuid(), label: z.string().trim().max(120).default(""), path: linkTarget })).max(16).default([]),
  }),
  /**
   * Image and text rows (B3): each row a picture beside a heading, text and an optional
   * button; the sides alternate unless the style fixes them.
   */
  z.object({
    ...sectionBase,
    type: z.literal("image_text"),
    variant: variantOf("image_text"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    items: z
      .array(
        z.object({
          assetId: z.uuid(),
          heading: z.string().trim().min(1, "Enter the row's heading.").max(160),
          body: bodySchema.default([]),
          ctaLabel: z.string().trim().max(60).default(""),
          ctaPath: linkTarget,
        }),
      )
      .max(8)
      .default([]),
  }),
  /**
   * Photo band (B3): a picture across the full width of the page under a wash of a brand
   * colour, with a heading, text and a button over it. The wash is an enumerated tint of a
   * brand token, so the text pairing is one the contrast gate checks.
   */
  z.object({
    ...sectionBase,
    type: z.literal("image_band"),
    variant: variantOf("image_band"),
    appearance: appearanceSchema,
    heading: z.string().trim().max(160).default(""),
    text: z.string().trim().max(600).default(""),
    imageAssetId: z.uuid().nullable().default(null),
    tint: z.enum(bandTints).default("dark"),
    strength: z.enum(bandStrengths).default("medium"),
    ctaLabel: z.string().trim().max(60).default(""),
    ctaPath: linkTarget,
    secondaryLabel: z.string().trim().max(60).default(""),
    secondaryPath: linkTarget,
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
  category_list: "Category list (from the places)",
  location_collection: "Location collection",
  contact_callout: "Contact callout",
  inquiry_form: "Inquiry form",
  faq: "Questions and answers",
  quotes: "Quotes",
  cta_banner: "Call to action",
  gallery: "Gallery",
  facts: "Facts",
  video: "Video (click to play)",
  map_link: "Map (link, or map on request)",
  team: "People",
  logo_strip: "Logo strip",
  image_text: "Image and text rows",
  image_band: "Photo band",
};

/** Owner-facing names for variants; "default" reads as "Site default". */
export const variantLabels: Record<string, string> = {
  default: "Site default",
  compact: "Compact",
  statement: "Statement (very large heading)",
  split: "Split: text beside the image",
  full: "Full-width image with text over it",
  stacked: "Image above the text",
  offset: "Offset: the words overlap the picture",
  collage: "Collage: the picture with up to three more",
  columns: "Two columns",
  lead: "Lead paragraph",
  grid: "Grid",
  list: "List",
  cards: "Cards",
  text: "Text only",
  featured: "Featured item and list",
  chips: "Chips",
  banner: "Banner",
  wide: "Wide",
  accordion: "Expandable questions",
  open: "All answers shown",
  single: "One large quotation",
  centered: "Centred",
  strip: "Horizontal strip",
  inline: "Inline",
  card: "Card",
  row: "One row",
  mono: "One row, in greyscale",
  alternating: "Alternating sides",
  image_left: "Image on the left",
  image_right: "Image on the right",
  tall: "Tall",
};

export const bandTintLabels: Record<BandTint, string> = { primary: "Primary colour", accent: "Accent colour", dark: "Text colour" };
export const bandStrengthLabels: Record<(typeof bandStrengths)[number], string> = { light: "Light wash", medium: "Medium wash", strong: "Strong wash" };

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
    category_list: { heading: "Browse by category" },
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
    team: { heading: "The people" },
    logo_strip: {},
    image_text: {},
    image_band: { appearance: { align: "center" } },
  };
  return sectionSchema.parse({ id, type, ...seeds[type] });
}

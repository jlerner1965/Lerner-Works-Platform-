import { z } from "zod";
import { bodySchema } from "@/lib/richtext";
import { commonFields } from "@/modules/common";

const sectionBase = { id: z.string().min(1).max(64) };
const internalPath = z.union([z.literal(""), z.string().regex(/^\/[^\s]*$/, "Use a site-relative path such as /contact.")]).default("");

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    ...sectionBase,
    type: z.literal("text_hero"),
    heading: z.string().trim().min(1).max(160),
    subheading: z.string().trim().max(400).default(""),
    ctaLabel: z.string().trim().max(60).default(""),
    ctaPath: internalPath,
  }),
  z.object({
    ...sectionBase,
    type: z.literal("image_hero"),
    heading: z.string().trim().min(1).max(160),
    subheading: z.string().trim().max(400).default(""),
    imageAssetId: z.uuid().nullable().default(null),
    ctaLabel: z.string().trim().max(60).default(""),
    ctaPath: internalPath,
  }),
  z.object({ ...sectionBase, type: z.literal("rich_text"), heading: z.string().trim().max(160).default(""), body: bodySchema.default([]) }),
  z.object({
    ...sectionBase,
    type: z.literal("feature_list"),
    heading: z.string().trim().max(160).default(""),
    items: z
      .array(z.object({ title: z.string().trim().min(1).max(120), text: z.string().trim().max(400).default(""), path: internalPath }))
      .max(12)
      .default([]),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("content_collection"),
    heading: z.string().trim().max(160).default(""),
    kind: z.enum(["place", "event", "article", "service"]),
    mode: z.enum(["selected", "latest", "upcoming"]).default("latest"),
    itemIds: z.array(z.uuid()).max(24).default([]),
    limit: z.number().int().min(1).max(24).default(6),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("location_collection"),
    heading: z.string().trim().max(160).default(""),
    mode: z.enum(["selected", "all"]).default("all"),
    itemIds: z.array(z.uuid()).max(24).default([]),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("contact_callout"),
    heading: z.string().trim().min(1).max(160),
    text: z.string().trim().max(600).default(""),
    showContactDetails: z.boolean().default(true),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("inquiry_form"),
    heading: z.string().trim().max(160).default("Send an inquiry"),
    intro: z.string().trim().max(600).default(""),
    locationSelect: z.boolean().default(false),
  }),
]);

export type PageSection = z.infer<typeof sectionSchema>;
export type SectionType = PageSection["type"];

export const sectionTypeLabels: Record<SectionType, string> = {
  text_hero: "Text hero",
  image_hero: "Image hero",
  rich_text: "Rich text",
  feature_list: "Feature list",
  content_collection: "Content collection",
  location_collection: "Location collection",
  contact_callout: "Contact callout",
  inquiry_form: "Inquiry form",
};

export const pagePayloadSchema = z.object({
  ...commonFields,
  sections: z.array(sectionSchema).max(30).default([]),
});
export type PagePayload = z.infer<typeof pagePayloadSchema>;

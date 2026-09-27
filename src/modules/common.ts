import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/slug";
import { bodySchema } from "@/lib/richtext";

export const slugSchema = z.string().regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens.");
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format.");
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the HH:MM 24-hour format.");
export const ianaTimeZoneSchema = z.string().min(1).max(64).refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Enter a valid IANA time zone such as America/Denver." },
);

/**
 * A document from the media library listed as a download on the item's page (site-building
 * programme B5-1). The label is the link text; empty means the document's own title.
 */
export const attachmentSchema = z.object({
  assetId: z.uuid(),
  label: z.string().trim().max(120).default(""),
});
export type Attachment = z.infer<typeof attachmentSchema>;

/** Fields shared by every content type (see build guide, section 8). */
export const commonFields = {
  schemaVersion: z.literal(1).default(1),
  title: z.string().trim().min(1, "Title is required.").max(200),
  slug: slugSchema,
  summary: z.string().trim().max(500).default(""),
  body: bodySchema.default([]),
  featuredImageAssetId: z.uuid().nullable().default(null),
  /** Documents listed as downloads under the body (B5-1); pages use the `downloads` section instead. */
  attachments: z.array(attachmentSchema).max(20).default([]),
  metaTitle: z.string().trim().max(70).default(""),
  metaDescription: z.string().trim().max(200).default(""),
  indexable: z.boolean().default(true),
  sourceUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).default(""),
  lastVerifiedOn: z.union([z.literal(""), dateOnlySchema]).default(""),
  attribution: z.string().trim().max(300).default(""),
};

export const intervalSchema = z
  .object({
    open: timeOfDaySchema,
    close: timeOfDaySchema,
    closesNextDay: z.boolean().default(false),
  })
  .refine((v) => v.closesNextDay || v.close > v.open, { message: "Closing time must be after opening time unless it closes the next day." });

export type HoursInterval = z.infer<typeof intervalSchema>;

export const weekdayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof weekdayKeys)[number];

export const weeklyHoursSchema = z.object({
  mon: z.array(intervalSchema).max(4).default([]),
  tue: z.array(intervalSchema).max(4).default([]),
  wed: z.array(intervalSchema).max(4).default([]),
  thu: z.array(intervalSchema).max(4).default([]),
  fri: z.array(intervalSchema).max(4).default([]),
  sat: z.array(intervalSchema).max(4).default([]),
  sun: z.array(intervalSchema).max(4).default([]),
});
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;

export const hoursExceptionSchema = z.object({
  date: dateOnlySchema,
  label: z.string().trim().max(80).default(""),
  closed: z.boolean().default(true),
  intervals: z.array(intervalSchema).max(4).default([]),
});
export type HoursException = z.infer<typeof hoursExceptionSchema>;

export const addressSchema = z.object({
  line1: z.string().trim().max(120).default(""),
  line2: z.string().trim().max(120).default(""),
  locality: z.string().trim().max(80).default(""),
  region: z.string().trim().max(80).default(""),
  postalCode: z.string().trim().max(20).default(""),
  /** Only owner-approved addresses may produce direction links in live mode. */
  approved: z.boolean().default(false),
});
export type Address = z.infer<typeof addressSchema>;

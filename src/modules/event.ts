import { z } from "zod";
import { commonFields, ianaTimeZoneSchema } from "@/modules/common";

const instant = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: "Enter a valid date and time." });

export const eventPayloadSchema = z
  .object({
    ...commonFields,
    startsAt: instant,
    endsAt: instant,
    timeZone: ianaTimeZoneSchema,
    venueItemId: z.uuid().nullable().default(null),
    venueText: z.string().trim().max(200).default(""),
    organizerName: z.string().trim().max(120).default(""),
    organizerUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).default(""),
    status: z.enum(["scheduled", "cancelled", "postponed"]).default("scheduled"),
    eventUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).default(""),
    admission: z.string().trim().max(200).default(""),
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), { message: "End must be after start.", path: ["endsAt"] });
export type EventPayload = z.infer<typeof eventPayloadSchema>;

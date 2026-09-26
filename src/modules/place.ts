import { z } from "zod";
import { addressSchema, commonFields, weeklyHoursSchema } from "@/modules/common";

export const placePayloadSchema = z.object({
  ...commonFields,
  category: z.string().trim().min(1, "Category is required.").max(60),
  address: addressSchema.default({ line1: "", line2: "", locality: "", region: "", postalCode: "", approved: false }),
  areaDescription: z.string().trim().max(200).default(""),
  website: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).default(""),
  phone: z.string().trim().max(40).default(""),
  /** null means hours are unknown; never inferred from the category. */
  hours: weeklyHoursSchema.nullable().default(null),
  nextAction: z
    .object({ label: z.string().trim().max(60).default(""), path: z.string().trim().max(500).default("") })
    .default({ label: "", path: "" }),
});
export type PlacePayload = z.infer<typeof placePayloadSchema>;

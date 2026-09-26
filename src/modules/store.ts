import { z } from "zod";
import { addressSchema, commonFields, hoursExceptionSchema, ianaTimeZoneSchema, weeklyHoursSchema } from "@/modules/common";

export const storePayloadSchema = z.object({
  ...commonFields,
  address: addressSchema,
  phone: z.string().trim().max(40).default(""),
  timeZone: ianaTimeZoneSchema,
  /** null means hours are unknown; an empty day means closed that day. */
  weeklyHours: weeklyHoursSchema.nullable().default(null),
  exceptions: z.array(hoursExceptionSchema).max(60).default([]),
  serviceItemIds: z.array(z.uuid()).max(50).default([]),
  status: z.enum(["open", "temporarily_closed", "permanently_closed"]).default("open"),
  statusNote: z.string().trim().max(200).default(""),
});
export type StorePayload = z.infer<typeof storePayloadSchema>;

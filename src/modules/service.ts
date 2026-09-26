import { z } from "zod";
import { commonFields } from "@/modules/common";

export const servicePayloadSchema = z.object({
  ...commonFields,
  inquiryPrompt: z.string().trim().max(300).default(""),
});
export type ServicePayload = z.infer<typeof servicePayloadSchema>;

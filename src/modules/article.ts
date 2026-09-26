import { z } from "zod";
import { commonFields, dateOnlySchema } from "@/modules/common";

export const articlePayloadSchema = z.object({
  ...commonFields,
  authorName: z.string().trim().min(1, "An author or organizational attribution is required.").max(120),
  publishedOn: dateOnlySchema,
  updatedOn: z.union([z.literal(""), dateOnlySchema]).default(""),
});
export type ArticlePayload = z.infer<typeof articlePayloadSchema>;

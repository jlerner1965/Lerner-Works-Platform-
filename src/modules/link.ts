import { z } from "zod";
import { commonFields } from "@/modules/common";

/**
 * A link to another website as content (site-building programme B5-2): the site's own title,
 * picture and words about an outside resource, grouped by category. The public site lists
 * links as cards that open the other site directly (https only, never with a referrer) and
 * gives each link a small page of its own for search results and sharing. Nothing is fetched
 * from the other site: the title, picture and text are the owner's.
 */
export const linkPayloadSchema = z.object({
  ...commonFields,
  url: z.url({ protocol: /^https$/, error: "Enter the full https:// address of the other website." }).max(1000),
  /** Grouping on the links page ("Partners", "Town services"); free text, reused for consistency. */
  category: z.string().trim().max(60).default(""),
  /** The button's words on the link's own page; empty means "Visit <host>". */
  ctaLabel: z.string().trim().max(60).default(""),
});
export type LinkPayload = z.infer<typeof linkPayloadSchema>;

/** The host name shown beside an outside link ("example.org"), or the address itself when it cannot be parsed. */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

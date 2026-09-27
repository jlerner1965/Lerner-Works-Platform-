import { handleUploadedInquiry } from "@/server/uploaded/serve";

export const dynamic = "force-dynamic";

/**
 * The contact form endpoint of an uploaded site (B7): the proxy rewrites `/_lw/inquiry` on
 * the site's hostname here (a folder starting with an underscore is private to Next.js and
 * never routed, so the segment cannot be `_lw`); an HTML form post, answered with a redirect
 * back into the site.
 */
export async function POST(request: Request, ctx: { params: Promise<{ mode: string; target: string }> }) {
  return handleUploadedInquiry(request, await ctx.params);
}

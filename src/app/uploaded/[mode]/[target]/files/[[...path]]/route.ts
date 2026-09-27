import { serveUploaded } from "@/server/uploaded/serve";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ mode: string; target: string; path?: string[] }> };

/**
 * Files of an uploaded site (B7), reached only through the proxy's rewrite of a preview or
 * live hostname to /uploaded/<mode>/<target>/files/<path>. The `files` segment keeps every
 * path of the site clear of the form handler beside it.
 */
export async function GET(request: Request, ctx: Ctx) {
  return serveUploaded(request, await ctx.params);
}

export async function HEAD(request: Request, ctx: Ctx) {
  return serveUploaded(request, await ctx.params);
}

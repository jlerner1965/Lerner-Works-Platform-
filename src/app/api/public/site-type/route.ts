import { withAnon } from "@/server/data/db";
import { normalizeHost } from "@/server/publishing/public-site";

export const dynamic = "force-dynamic";

/**
 * Which kind of site a verified, active hostname serves (B7): the proxy asks before routing a
 * customer domain, and caches the answer briefly. Public data through the anon-callable
 * function; unknown hosts answer null.
 */
export async function GET(request: Request) {
  const host = normalizeHost(new URL(request.url).searchParams.get("host"));
  if (!host) return Response.json({ type: null }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const rows = await withAnon((db) => db<{ type: string | null }[]>`select public.get_host_site_type(${host}) as type`);
  return Response.json({ type: rows[0]?.type ?? null }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60" } });
}

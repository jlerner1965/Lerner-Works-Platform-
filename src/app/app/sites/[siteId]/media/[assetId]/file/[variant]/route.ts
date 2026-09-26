import { getSessionUser } from "@/server/auth/session";
import { withUser } from "@/server/data/db";
import { getStorage } from "@/server/media/storage";

export const dynamic = "force-dynamic";

/** Private derivative of a site's asset for dashboard thumbnails and draft previews. */
export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; assetId: string; variant: string }> }) {
  const { siteId, assetId, variant } = await params;
  const user = await getSessionUser();
  const deny = (status: number) => new Response(status === 401 ? "Unauthorized" : "Not found", { status, headers: { "Cache-Control": "private, no-store" } });
  if (!user) return deny(401);
  if (!/^w(480|960|1600)$/.test(variant) || !/^[0-9a-f-]{36}$/i.test(assetId) || !/^[0-9a-f-]{36}$/i.test(siteId)) return deny(404);
  const rows = await withUser(user.id, (db) => db<{ derivatives: Record<string, { key: string }> }[]>`
    select derivatives from public.media_assets where id = ${assetId} and site_id = ${siteId}`);
  const key = rows[0]?.derivatives[variant]?.key;
  if (!key) return deny(404);
  const data = await getStorage().getPrivate(key);
  if (!data) return deny(404);
  return new Response(data as BodyInit, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex" } });
}

import { getSessionUser } from "@/server/auth/session";
import { withUser } from "@/server/data/db";
import { getStorage } from "@/server/media/storage";

export const dynamic = "force-dynamic";

/**
 * Private derivative of a site's asset for dashboard thumbnails and draft previews: an image
 * width, or `document` for a document's file (B5-1), opened in the browser under its own name.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; assetId: string; variant: string }> }) {
  const { siteId, assetId, variant } = await params;
  const user = await getSessionUser();
  const deny = (status: number) => new Response(status === 401 ? "Unauthorized" : "Not found", { status, headers: { "Cache-Control": "private, no-store" } });
  if (!user) return deny(401);
  if (!/^(w(480|960|1600)|document)$/.test(variant) || !/^[0-9a-f-]{36}$/i.test(assetId) || !/^[0-9a-f-]{36}$/i.test(siteId)) return deny(404);
  const rows = await withUser(user.id, (db) => db<{ derivatives: Record<string, { key: string }>; mimeType: string; title: string | null; kind: string }[]>`
    select derivatives, mime_type, title, kind::text from public.media_assets where id = ${assetId} and site_id = ${siteId}`);
  const row = rows[0];
  const key = variant === "document" ? (row?.kind === "document" ? row.derivatives.file?.key : undefined) : row?.derivatives[variant]?.key;
  if (!row || !key) return deny(404);
  const data = await getStorage().getPrivate(key);
  if (!data) return deny(404);
  const headers: Record<string, string> = { "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" };
  if (variant === "document") {
    const name = (row.title || "document").replace(/[^A-Za-z0-9._ -]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "document";
    headers["Content-Type"] = row.mimeType;
    headers["Content-Disposition"] = `inline; filename="${name}.pdf"`;
  } else {
    headers["Content-Type"] = "image/webp";
  }
  return new Response(data as BodyInit, { headers });
}

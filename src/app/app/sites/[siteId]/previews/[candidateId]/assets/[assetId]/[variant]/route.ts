import { getSessionUser } from "@/server/auth/session";
import { withUser } from "@/server/data/db";
import { getCandidate } from "@/server/publishing/candidates";
import { getStorage } from "@/server/media/storage";

export const dynamic = "force-dynamic";

/** Private derivative for a candidate preview. Authorization is re-checked per request. */
export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; candidateId: string; assetId: string; variant: string }> }) {
  const { siteId, candidateId, assetId, variant } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "private, no-store" } });
  if (!/^w(480|960|1600)$/.test(variant)) return new Response("Not found", { status: 404 });
  const cand = await withUser(user.id, (db) => getCandidate(db, candidateId));
  if (!cand || cand.siteId !== siteId) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const media = cand.manifest.media[assetId];
  const v = media?.variants[variant as "w480" | "w960" | "w1600"];
  if (!v) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const data = await getStorage().getPrivate(v.key);
  if (!data) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return new Response(data as BodyInit, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}

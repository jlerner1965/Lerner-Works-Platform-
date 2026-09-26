import { getSessionUser } from "@/server/auth/session";
import { withUser } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { exportSitePackage } from "@/server/import/package";

export const dynamic = "force-dynamic";

/** Owner-only portable site package download (ZIP). */
export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const result = await withUser(user.id, async (db) => {
    const ctx = await loadSiteContext(db, siteId);
    if (!ctx?.capabilities.isOwner) return null;
    const zip = await exportSitePackage(db, ctx.site);
    await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata) values (${ctx.site.organizationId}, ${siteId}, ${user.id}, 'site.exported', 'site', ${siteId}, ${db.json({ bytes: zip.byteLength })})`;
    return { zip, key: ctx.site.key };
  });
  if (!result) return new Response("Not found", { status: 404 });
  return new Response(result.zip as BodyInit, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="site-package-${result.key}-${new Date().toISOString().slice(0, 10)}.zip"`, "Cache-Control": "private, no-store" } });
}

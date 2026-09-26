import { getSessionUser } from "@/server/auth/session";
import { withUser } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { listInquiries, inquiriesToCsv } from "@/server/inquiries/inbox";

export const dynamic = "force-dynamic";

/** CSV export of the filtered inbox (owners/publishers). Cells are escaped against formula injection. */
export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const location = url.searchParams.get("location") ?? undefined;
  const result = await withUser(user.id, async (db) => {
    const ctx = await loadSiteContext(db, siteId);
    if (!ctx?.capabilities.canViewInquiries) return null;
    const list = await listInquiries(db, {
      siteId,
      status: ["new", "in_progress", "resolved", "spam"].includes(status) ? (status as "new") : "all",
      from: /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") ? from : undefined,
      to: /^\d{4}-\d{2}-\d{2}$/.test(to ?? "") ? to : undefined,
      locationId: /^[0-9a-f-]{36}$/i.test(location ?? "") ? location : undefined,
      page: 1,
      pageSize: 100,
    });
    let rows = list.rows;
    let page = 2;
    while (rows.length < list.total && page <= 50) {
      const next = await listInquiries(db, { siteId, status: status as "all", from, to, locationId: location, page, pageSize: 100 });
      rows = rows.concat(next.rows);
      page++;
    }
    await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata)
      values (${ctx.site.organizationId}, ${siteId}, ${user.id}, 'inquiries.exported', 'site', ${siteId}, ${db.json({ count: rows.length, status })})`;
    return { csv: inquiriesToCsv(rows), key: ctx.site.key };
  });
  if (!result) return new Response("Not found", { status: 404 });
  return new Response(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inquiries-${result.key}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

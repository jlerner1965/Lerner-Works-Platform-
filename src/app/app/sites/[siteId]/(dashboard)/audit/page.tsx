import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { Card, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Append-only audit trail for sensitive actions on this site and its organization. */
export default async function AuditPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/audit`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canPublish) notFound();
  const events = await withUser(user.id, (db) => db<Array<{ id: string; action: string; entityType: string | null; entityId: string | null; metadata: Record<string, unknown>; createdAt: Date; actor: string | null; siteId: string | null }>>`
    select e.id, e.action, e.entity_type, e.entity_id, e.metadata, e.created_at, public.user_display(e.actor_id) as actor, e.site_id
    from public.audit_events e where e.organization_id = ${ctx.organization.id} and (e.site_id = ${siteId} or e.site_id is null)
    order by e.created_at desc limit 200`);
  return (
    <>
      <PageHeader eyebrow={ctx.site.name} title="Audit log" description="Sensitive actions recorded by the database functions and server actions: publishing, restores, membership and invitation changes, media withdrawal, exports and imports. Entries cannot be edited or deleted." />
      <Card title={`Latest ${events.length} events`}>
        {events.length === 0 ? <EmptyState title="No events yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle"><th className="py-2 pr-3">When</th><th className="py-2 pr-3">Actor</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Entity</th><th className="py-2">Details</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-line align-top">
                    <td className="whitespace-nowrap py-2 pr-3">{formatDateTime(e.createdAt, ctx.site.timeZone)}</td>
                    <td className="py-2 pr-3">{e.actor ?? "system / unknown"}</td>
                    <td className="py-2 pr-3"><code>{e.action}</code>{e.siteId ? "" : <span className="ml-1 text-xs text-ink-subtle">(organization)</span>}</td>
                    <td className="py-2 pr-3 text-xs text-ink-muted">{e.entityType ?? "—"}{e.entityId ? ` ${e.entityId.slice(0, 8)}` : ""}</td>
                    <td className="py-2 text-xs text-ink-muted"><code className="break-all">{JSON.stringify(e.metadata)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

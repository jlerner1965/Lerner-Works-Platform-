import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { Card, PageHeader, Badge, formatDateTime } from "@/components/admin/ui";
import { MemberRow, InviteForm, RevokeInvitationForm } from "@/components/admin/access-forms";

export const dynamic = "force-dynamic";

export default async function AccessPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/access`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.isOwner) notFound();
  const data = await withUser(user.id, async (db) => {
    const members = await db<Array<{ userId: string; email: string; organizationRole: "owner" | "member"; siteRoles: Array<{ siteId: string; siteRole: string }>; joinedAt: Date }>>`select * from public.list_organization_members(${ctx.organization.id})`;
    const invitations = await db<Array<{ id: string; email: string; organizationRole: string; siteAssignments: Array<{ siteId: string; siteRole: string }>; expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null; createdAt: Date }>>`
      select id, email, organization_role::text, site_assignments, expires_at, accepted_at, revoked_at, created_at from public.invitations where organization_id = ${ctx.organization.id} order by created_at desc limit 50`;
    const sites = await db<{ id: string; name: string }[]>`select id, name from public.sites where organization_id = ${ctx.organization.id} order by name`;
    return { members, invitations, sites };
  });
  const owners = data.members.filter((m) => m.organizationRole === "owner").length;
  const siteName = new Map(data.sites.map((s) => [s.id, s.name]));
  return (
    <>
      <PageHeader eyebrow={ctx.organization.name} title="Access" description="Organization owners see every site and publish anywhere in the organization. Site roles (publisher, editor, reviewer) are assigned per site. The last owner cannot be removed or demoted." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card title={`Members (${data.members.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle"><th className="py-2 pr-3">Person</th><th className="py-2 pr-3">Organization role</th><th className="py-2 pr-3">Role on {ctx.site.name}</th><th className="py-2 pr-3">Other sites</th><th className="py-2">Actions</th></tr></thead>
              <tbody>
                {data.members.map((m) => (
                  <MemberRow
                    key={m.userId}
                    siteId={siteId}
                    member={{ userId: m.userId, email: m.email, organizationRole: m.organizationRole, siteRole: m.siteRoles.find((r) => r.siteId === siteId)?.siteRole ?? "none", joinedAt: m.joinedAt.toISOString() }}
                    otherSites={m.siteRoles.filter((r) => r.siteId !== siteId).map((r) => `${siteName.get(r.siteId) ?? r.siteId.slice(0, 8)}: ${r.siteRole}`)}
                    isSelf={m.userId === user.id}
                    isLastOwner={m.organizationRole === "owner" && owners <= 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Invite someone">
            <InviteForm siteId={siteId} siteName={ctx.site.name} />
          </Card>
          <Card title="Invitations">
            {data.invitations.length === 0 ? <p className="text-sm text-ink-muted">No invitations yet.</p> : (
              <ul className="divide-y divide-line text-sm">
                {data.invitations.map((inv) => {
                  const state = inv.acceptedAt ? "accepted" : inv.revokedAt ? "revoked" : inv.expiresAt < new Date() ? "expired" : "pending";
                  return (
                    <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div>
                        <p className="font-medium">{inv.email}</p>
                        <p className="text-xs text-ink-subtle">{inv.organizationRole}{inv.siteAssignments.length ? ` · ${inv.siteAssignments.map((a) => `${siteName.get(a.siteId) ?? "site"}: ${a.siteRole}`).join(", ")}` : ""} · {state === "pending" ? `expires ${formatDateTime(inv.expiresAt, ctx.site.timeZone)}` : state}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={state === "pending" ? "info" : state === "accepted" ? "success" : "neutral"}>{state}</Badge>
                        {state === "pending" ? <RevokeInvitationForm siteId={siteId} invitationId={inv.id} /> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

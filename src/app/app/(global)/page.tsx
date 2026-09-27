import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { listOrganizations, listSites } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, formatDateTime } from "@/components/admin/ui";
import { presets } from "@/modules/presets";

export const dynamic = "force-dynamic";

interface RemovedSite {
  organizationId: string;
  name: string | null;
  key: string | null;
  createdAt: Date;
  actor: string | null;
}

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/app");
  const params = await searchParams;
  const [orgs, sites] = await Promise.all([listOrganizations(user.id), listSites(user.id)]);
  const canCreate = orgs.some((o) => o.role === "owner");
  // Sites removed from the organizations the person owns stay on the audit trail (B6).
  const removed = canCreate
    ? await withUser(user.id, (db) => db<RemovedSite[]>`
        select e.organization_id, e.metadata->>'name' as name, e.metadata->>'key' as key, e.created_at, public.user_display(e.actor_id) as actor
        from public.audit_events e where e.action = 'site.deleted' order by e.created_at desc limit 20`)
    : [];
  const notice = typeof params.removed === "string" && typeof params.name === "string" ? { kind: params.removed, name: params.name, leftovers: Number(params.leftovers ?? 0) || 0 } : null;
  return (
    <>
      <PageHeader
        title="Organizations"
        description="Organizations you belong to and the sites you can work on. Only organizations where you hold a membership are listed."
        actions={canCreate ? <LinkButton href="/app/sites/new">Create site</LinkButton> : null}
      />
      {notice ? (
        <div className="mb-4">
          <Alert tone="success" role="status">
            {notice.kind === "organization" ? `Organization "${notice.name}" was deleted with its sites.` : `Site "${notice.name}" was deleted.`}
            {notice.leftovers ? ` ${notice.leftovers} storage object(s) could not be removed; they are listed in the activity log under site.storage_cleanup_failed.` : ""}
          </Alert>
        </div>
      ) : null}
      {orgs.length === 0 ? (
        <EmptyState title="No organization access" description="Your account is not a member of any organization. Ask an organization owner for an invitation." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orgs.map((org) => {
            const orgSites = sites.filter((s) => s.organizationId === org.id);
            const orgRemoved = removed.filter((r) => r.organizationId === org.id);
            return (
              <Card
                key={org.id}
                title={
                  <span className="flex items-center gap-2">
                    {org.name} <Badge tone={org.role === "owner" ? "info" : "neutral"}>{org.role}</Badge>
                  </span>
                }
              >
                {orgSites.length === 0 ? (
                  <p className="text-sm text-ink-muted">{org.siteCount === 0 ? "No sites yet." : "No sites assigned to you in this organization."}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {orgSites.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <Link href={`/app/sites/${s.id}`} className="font-medium hover:underline">
                            {s.name}
                          </Link>
                          <p className="text-xs text-ink-subtle">
                            {presets[s.preset].label} · {s.mode === "demo" ? "demonstration" : "live"} · {s.activeReleaseId ? "published" : "not yet published"}
                          </p>
                        </div>
                        <LinkButton href={`/app/sites/${s.id}`} variant="secondary">
                          Open
                        </LinkButton>
                      </li>
                    ))}
                  </ul>
                )}
                {org.role === "owner" ? (
                  <div className="mt-3 border-t border-line pt-2 text-xs text-ink-subtle">
                    {orgRemoved.length ? (
                      <p>
                        Removed: {orgRemoved.map((r) => `${r.name ?? "site"} (${r.key ?? "?"}, ${formatDateTime(r.createdAt, "UTC")}${r.actor ? `, by ${r.actor}` : ""})`).join("; ")}
                      </p>
                    ) : null}
                    <p className={orgRemoved.length ? "mt-1" : ""}>
                      <Link href={`/app/organizations/${org.id}/remove`} aria-label={`Remove organization ${org.name}`} className="text-danger underline">
                        Remove organization…
                      </Link>
                    </p>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

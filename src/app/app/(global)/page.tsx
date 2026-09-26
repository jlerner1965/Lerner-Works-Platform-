import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { listOrganizations, listSites } from "@/server/data/access";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/admin/ui";
import { presets } from "@/modules/presets";

export default async function OrganizationsPage() {
  const user = await requireUser("/app");
  const [orgs, sites] = await Promise.all([listOrganizations(user.id), listSites(user.id)]);
  const canCreate = orgs.some((o) => o.role === "owner");
  return (
    <>
      <PageHeader
        title="Organizations"
        description="Organizations you belong to and the sites you can work on. Only organizations where you hold a membership are listed."
        actions={canCreate ? <LinkButton href="/app/sites/new">Create site</LinkButton> : null}
      />
      {orgs.length === 0 ? (
        <EmptyState title="No organization access" description="Your account is not a member of any organization. Ask an organization owner for an invitation." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orgs.map((org) => {
            const orgSites = sites.filter((s) => s.organizationId === org.id);
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
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

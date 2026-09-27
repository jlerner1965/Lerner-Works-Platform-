import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { withUser } from "@/server/data/db";
import { Card, PageHeader } from "@/components/admin/ui";
import { RemoveOrganizationForm } from "@/components/admin/removal-forms";

export const dynamic = "force-dynamic";

/** Removing an organization (B6): owners only; every site of it goes first, then the memberships and invitations; the row stays as a tombstone with its audit trail. */
export default async function RemoveOrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) notFound();
  const user = await requireUser(`/app/organizations/${organizationId}/remove`);
  const data = await withUser(user.id, async (db) => {
    const orgs = await db<Array<{ id: string; name: string; isOwner: boolean; othersOwned: number }>>`
      select o.id, o.name,
        (select m.organization_role = 'owner' from public.memberships m where m.organization_id = o.id and m.user_id = auth.uid()) as is_owner,
        (select count(*)::int from public.memberships m where m.user_id = auth.uid() and m.organization_role = 'owner' and m.organization_id <> o.id) as others_owned
      from public.organizations o where o.id = ${organizationId} and o.status = 'active'`;
    const org = orgs[0];
    if (!org?.isOwner) return null;
    const sites = await db<Array<{ id: string; key: string; name: string; mode: "demo" | "live" }>>`select id, key, name, mode::text from public.sites where organization_id = ${organizationId} order by name`;
    return { org, sites };
  });
  if (!data) notFound();
  const live = data.sites.filter((s) => s.mode === "live");
  const blockedBy = data.org.othersOwned === 0
    ? "This is the last organization you own. Create the next one first (Create site → Create a new organization…), so that you keep the ability to create organizations; then come back."
    : live.length
      ? `${live.map((s) => s.name).join(", ")} ${live.length === 1 ? "is" : "are"} live on a domain. Return ${live.length === 1 ? "it" : "them"} to demonstration mode and disable the domains in the site's Settings first.`
      : null;
  return (
    <>
      <PageHeader eyebrow={data.org.name} title="Remove this organization" description="Owners only. What goes is listed below; the confirmation is the organization's name, typed exactly." />
      <div className="max-w-2xl">
        <Card title={data.org.name}>
          <RemoveOrganizationForm organizationId={data.org.id} name={data.org.name} sites={data.sites} blockedBy={blockedBy} />
          <p className="mt-4 text-xs text-ink-subtle">
            <Link href="/app" className="underline">Back to organizations</Link>
          </p>
        </Card>
      </div>
    </>
  );
}

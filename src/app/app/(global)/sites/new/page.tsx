import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { listOrganizations } from "@/server/data/access";
import { PageHeader } from "@/components/admin/ui";
import { CreateSiteForm } from "@/components/admin/create-site-form";
import { presets } from "@/modules/presets";

export const dynamic = "force-dynamic";

export default async function NewSitePage() {
  const user = await requireUser("/app/sites/new");
  const orgs = (await listOrganizations(user.id)).filter((o) => o.role === "owner");
  if (orgs.length === 0) notFound();
  return (
    <>
      <PageHeader title="Create site" description="Creates database records from a preset: a site, its first configuration revision and empty starter pages. No source code is changed. A new site contains empty states, not demonstration content." />
      <CreateSiteForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} presets={Object.values(presets).map((p) => ({ key: p.key, label: p.label, description: p.description, defaultTimeZone: p.defaultTimeZone }))} />
    </>
  );
}

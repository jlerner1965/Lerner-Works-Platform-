import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext, listSites } from "@/server/data/access";
import { AdminShell } from "@/components/admin/shell";
import { siteNavSections } from "@/server/data/site-nav";

export default async function SiteDashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser(`/app/sites/${siteId}`);
  const [ctx, sites] = await Promise.all([getSiteContext(user.id, siteId), listSites(user.id)]);
  if (!ctx) notFound();
  return (
    <AdminShell
      user={user}
      sites={sites}
      currentSiteId={ctx.site.id}
      sections={siteNavSections(ctx)}
      breadcrumbs={[{ label: "Organizations", href: "/app" }, { label: ctx.organization.name }, { label: ctx.site.name, href: `/app/sites/${ctx.site.id}` }]}
    >
      {children}
    </AdminShell>
  );
}

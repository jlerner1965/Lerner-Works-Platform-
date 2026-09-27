import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext, listSites } from "@/server/data/access";
import { AdminShell } from "@/components/admin/shell";
import { siteNavSections } from "@/server/data/site-nav";

/** Dashboard sections that exist only for a structured site; an uploaded site (B7) has Upload instead. */
const STRUCTURED_ONLY = new Set(["content", "media", "look", "publishing", "reviews", "import"]);

export default async function SiteDashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser(`/app/sites/${siteId}`);
  const [ctx, sites, requestHeaders] = await Promise.all([getSiteContext(user.id, siteId), listSites(user.id), headers()]);
  if (!ctx) notFound();
  const path = requestHeaders.get("x-lw-path") ?? "";
  const prefix = `/app/sites/${siteId}/`;
  const section = path.startsWith(prefix) ? (path.slice(prefix.length).split("/")[0] ?? "") : "";
  if (ctx.site.siteType === "uploaded" ? STRUCTURED_ONLY.has(section) : section === "upload") notFound();
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

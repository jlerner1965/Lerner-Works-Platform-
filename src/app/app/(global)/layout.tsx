import { requireUser } from "@/server/auth/session";
import { listSites } from "@/server/data/access";
import { AdminShell } from "@/components/admin/shell";

export default async function GlobalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/app");
  const sites = await listSites(user.id);
  return (
    <AdminShell
      user={user}
      sites={sites}
      sections={[{ items: [{ label: "Organizations", href: "/app", exact: true }, { label: "Create site", href: "/app/sites/new" }] }]}
      breadcrumbs={[{ label: "Organizations" }]}
    >
      {children}
    </AdminShell>
  );
}

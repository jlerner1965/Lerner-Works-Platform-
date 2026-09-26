import type { NavSection } from "@/components/admin/shell";
import type { SiteContext } from "@/server/data/access";

/** Sidebar sections for a site, hiding anything the user cannot access. */
export function siteNavSections(ctx: SiteContext): NavSection[] {
  const base = `/app/sites/${ctx.site.id}`;
  const cap = ctx.capabilities;
  const items: NavSection["items"] = [{ label: "Overview", href: base, exact: true }];
  items.push({ label: "Content", href: `${base}/content` });
  if (cap.canEdit) items.push({ label: "Media", href: `${base}/media` });
  if (cap.canReview || cap.canEdit) items.push({ label: "Reviews", href: `${base}/reviews` });
  if (cap.canViewInquiries) items.push({ label: "Inquiries", href: `${base}/inquiries` });
  if (cap.canPublish) items.push({ label: "Publishing", href: `${base}/publishing` });
  if (cap.canManageSettings) items.push({ label: "Settings", href: `${base}/settings` });
  return [{ title: ctx.site.name, items }];
}

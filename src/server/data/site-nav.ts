import type { NavSection } from "@/components/admin/shell";
import type { SiteContext } from "@/server/data/access";
import { presets } from "@/modules/presets";
import { kindRegistry } from "@/modules/registry";

/**
 * Sidebar sections for a site, grouped by task (site-building programme B1): what the site
 * contains, what a person does with it, and how it is managed. Anything the user cannot
 * access is hidden.
 */
export function siteNavSections(ctx: SiteContext): NavSection[] {
  const base = `/app/sites/${ctx.site.id}`;
  const cap = ctx.capabilities;
  const sections: NavSection[] = [{ title: ctx.site.name, items: [{ label: "Overview", href: base, exact: true }] }];

  // An uploaded site (B7) has nothing to edit here: its pages arrive in the ZIP.
  if (ctx.site.siteType === "uploaded") {
    const site: NavSection["items"] = [];
    if (cap.canPublish) site.push({ label: "Upload", href: `${base}/upload` });
    if (cap.canViewInquiries) site.push({ label: "Inbox", href: `${base}/inquiries` });
    if (cap.canManageSettings) site.push({ label: "Settings", href: `${base}/settings` });
    if (site.length) sections.push({ title: "Site", items: site });
    const manage: NavSection["items"] = [];
    if (cap.canManageAccess) manage.push({ label: "Team", href: `${base}/access` });
    if (cap.canPublish) manage.push({ label: "Activity log", href: `${base}/audit` });
    if (manage.length) sections.push({ title: "Manage", items: manage });
    return sections;
  }

  const content: NavSection["items"] = presets[ctx.site.preset].kinds.map((kind) => ({ label: kindRegistry[kind].plural, href: `${base}/content?kind=${kind}` }));
  if (cap.canEdit) content.push({ label: "Media", href: `${base}/media` });
  if (cap.canReview || cap.canEdit) content.push({ label: "Reviews", href: `${base}/reviews` });
  sections.push({ title: "Content", items: content });

  const site: NavSection["items"] = [];
  if (cap.canManageSettings) site.push({ label: "Look", href: `${base}/look` });
  if (cap.canPublish) site.push({ label: "Publish", href: `${base}/publishing` });
  if (cap.canViewInquiries) site.push({ label: "Inbox", href: `${base}/inquiries` });
  if (cap.canManageSettings) site.push({ label: "Settings", href: `${base}/settings` });
  if (site.length) sections.push({ title: "Site", items: site });

  const manage: NavSection["items"] = [];
  if (cap.canManageAccess) manage.push({ label: "Team", href: `${base}/access` });
  if (cap.canEdit) manage.push({ label: "Import & export", href: `${base}/import` });
  if (cap.canPublish) manage.push({ label: "Activity log", href: `${base}/audit` });
  if (manage.length) sections.push({ title: "Manage", items: manage });
  return sections;
}

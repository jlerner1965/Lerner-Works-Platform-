import { withUser, type Db } from "@/server/data/db";

export type OrgRole = "owner" | "member";
export type SiteRole = "publisher" | "editor" | "reviewer";

export interface SiteCapabilities {
  orgRole: OrgRole | null;
  siteRole: SiteRole | null;
  isOwner: boolean;
  canView: boolean;
  canEdit: boolean;
  canReview: boolean;
  canPublish: boolean;
  canViewInquiries: boolean;
  canManageAccess: boolean;
  canManageSettings: boolean;
  /** Design controls (design programme D-014, D-017): organization owners, and this site's publishers when the owner has delegated design to them. */
  canDesign: boolean;
}

export interface SiteRow {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  preset: "community_guide" | "location_business";
  timeZone: string;
  mode: "demo" | "live";
  status: "active" | "archived";
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  inquiryRecipients: string[];
  currentConfigRevisionId: string | null;
  activeReleaseId: string | null;
  /** Owner's per-site delegation of the design controls to publishers (D2). */
  designDelegated: boolean;
  /** Review policy (B1): true means every revision needs an explicit approval; false approves publishers' saves on save. */
  reviewRequired: boolean;
  demoContentLoadedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgSummary {
  id: string;
  name: string;
  role: OrgRole;
  siteCount: number;
}

export interface SiteSummary extends SiteRow {
  organizationName: string;
}

export interface SiteContext {
  site: SiteRow;
  organization: { id: string; name: string };
  capabilities: SiteCapabilities;
}

export function computeCapabilities(orgRole: OrgRole | null, siteRole: SiteRole | null, designDelegated = false): SiteCapabilities {
  const isOwner = orgRole === "owner";
  return {
    orgRole,
    siteRole,
    isOwner,
    canView: isOwner || siteRole !== null,
    canEdit: isOwner || siteRole === "editor" || siteRole === "publisher",
    canReview: isOwner || siteRole === "reviewer" || siteRole === "publisher",
    canPublish: isOwner || siteRole === "publisher",
    canViewInquiries: isOwner || siteRole === "publisher",
    canManageAccess: isOwner,
    canManageSettings: isOwner || siteRole === "publisher",
    canDesign: isOwner || (siteRole === "publisher" && designDelegated),
  };
}

export async function listOrganizations(userId: string): Promise<OrgSummary[]> {
  return withUser(userId, async (db) => {
    const rows = await db<{ id: string; name: string; role: OrgRole; siteCount: number }[]>`
      select o.id, o.name, m.organization_role as role,
        (select count(*)::int from public.sites s where s.organization_id = o.id and s.status = 'active') as site_count
      from public.organizations o
      join public.memberships m on m.organization_id = o.id and m.user_id = auth.uid()
      where o.status = 'active'
      order by o.name`;
    return rows;
  });
}

export async function listSites(userId: string): Promise<SiteSummary[]> {
  return withUser(userId, async (db) => {
    const rows = await db<SiteSummary[]>`
      select s.*, o.name as organization_name
      from public.sites s
      join public.organizations o on o.id = s.organization_id
      where s.status = 'active'
      order by o.name, s.name`;
    return rows;
  });
}

export async function loadSiteContext(db: Db, siteId: string): Promise<SiteContext | null> {
  const sites = await db<SiteRow[]>`select * from public.sites where id = ${siteId}`;
  const site = sites[0];
  if (!site) return null;
  const orgs = await db<{ id: string; name: string }[]>`select id, name from public.organizations where id = ${site.organizationId}`;
  const org = orgs[0];
  if (!org) return null;
  const roles = await db<{ orgRole: OrgRole | null; siteRole: SiteRole | null }[]>`
    select
      (select m.organization_role from public.memberships m where m.organization_id = ${site.organizationId} and m.user_id = auth.uid()) as org_role,
      (select sm.site_role from public.site_memberships sm where sm.site_id = ${siteId} and sm.user_id = auth.uid()) as site_role`;
  const role = roles[0] ?? { orgRole: null, siteRole: null };
  return { site, organization: org, capabilities: computeCapabilities(role.orgRole, role.siteRole, site.designDelegated) };
}

export async function getSiteContext(userId: string, siteId: string): Promise<SiteContext | null> {
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return null;
  return withUser(userId, (db) => loadSiteContext(db, siteId));
}

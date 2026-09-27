import { withUser } from "@/server/data/db";
import { getStorage } from "@/server/media/storage";

/**
 * Removing a site or an organization (site-building programme B6, decision D-025). The rules
 * live in the SQL functions: only an organization owner, with the site key or the organization
 * name typed as confirmation, never a site that is live on a domain, never the last
 * organization the person owns. The rows go in one transaction with the audit event; the
 * storage objects are removed afterwards, and any that could not be removed are written to the
 * audit trail with their keys.
 */

export interface RemovalCounts {
  items: number;
  releases: number;
  media: number;
  inquiries: number;
  members: number;
  domains: number;
}

export interface SiteRemoval {
  siteId: string;
  key: string;
  name: string;
  organizationId: string;
  counts: RemovalCounts;
  /** Storage objects removed after the rows: asset folders (private originals and derivatives) and public copies no other site's release carries. */
  storage: { assetFolders: number; publicCopies: number; leftovers: string[] };
}

interface DeleteSiteResult {
  key: string;
  name: string;
  organizationId: string;
  counts: RemovalCounts;
  privatePrefixes: string[];
  publicNames: string[];
}

export async function deleteSite(userId: string, siteId: string, confirmKey: string): Promise<SiteRemoval> {
  const rows = await withUser(userId, (db) => db<{ result: DeleteSiteResult }[]>`select public.delete_site(${siteId}, ${confirmKey}) as result`);
  const result = rows[0]!.result;
  const storage = getStorage();
  const leftovers: string[] = [];
  let assetFolders = 0;
  for (const prefix of result.privatePrefixes) {
    try {
      await storage.deletePrivatePrefix(prefix);
      assetFolders++;
    } catch {
      leftovers.push(prefix);
    }
  }
  let publicCopies = 0;
  if (result.publicNames.length) {
    try {
      await storage.deletePublic(result.publicNames);
      publicCopies = result.publicNames.length;
    } catch {
      leftovers.push(...result.publicNames);
    }
  }
  if (leftovers.length) {
    await withUser(userId, (db) => db`select public.record_removal_leftovers(${result.organizationId}, ${siteId}, ${db.json(leftovers)})`).catch(() => undefined);
  }
  return { siteId, key: result.key, name: result.name, organizationId: result.organizationId, counts: result.counts, storage: { assetFolders, publicCopies, leftovers } };
}

export interface OrganizationRemoval {
  name: string;
  sites: SiteRemoval[];
  members: number;
  invitations: number;
}

/** The organization's rules are checked first so that a refusal deletes nothing; then every site goes, then the organization. */
export async function deleteOrganization(userId: string, organizationId: string, confirmName: string): Promise<OrganizationRemoval> {
  await withUser(userId, (db) => db`select public.delete_organization(${organizationId}, ${confirmName}, true)`);
  const sites = await withUser(userId, (db) => db<{ id: string; key: string }[]>`select id, key from public.sites where organization_id = ${organizationId} order by name`);
  const removed: SiteRemoval[] = [];
  for (const site of sites) removed.push(await deleteSite(userId, site.id, site.key));
  const rows = await withUser(userId, (db) => db<{ result: { name: string; members: number; invitations: number } }[]>`select public.delete_organization(${organizationId}, ${confirmName}, false) as result`);
  const result = rows[0]!.result;
  return { name: result.name, sites: removed, members: result.members, invitations: result.invitations };
}

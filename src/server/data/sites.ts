import { withUser, type Db } from "@/server/data/db";
import { presets, type PresetKey } from "@/modules/presets";
import { siteConfigSchema, type SiteConfig } from "@/modules/site-config";
import { createContentItem, approveOnSave } from "@/server/data/content";

export interface ConfigRevisionRow {
  id: string;
  organizationId: string;
  siteId: string;
  version: number;
  schemaVersion: number;
  config: SiteConfig;
  changeNote: string | null;
  authorId: string | null;
  createdAt: Date;
}

export interface CreateSiteInput {
  organizationId: string;
  key: string;
  name: string;
  preset: PresetKey;
  timeZone: string;
  mode: "demo" | "live";
  contact: { email?: string; phone?: string; address?: string; inquiryRecipients?: string[] };
  /** Structured (built here from the preset) or uploaded (built anywhere, uploaded as a ZIP; no starter pages). */
  siteType?: "structured" | "uploaded";
}

/**
 * Creates a site from a preset: the site record, its first configuration revision, and the
 * preset's initial pages. Creates records only; no source code or repository is touched.
 * An uploaded site (B7) gets the record and the configuration, and no pages: its pages arrive
 * in the ZIP.
 */
export async function createSiteFromPreset(userId: string, input: CreateSiteInput): Promise<{ siteId: string }> {
  const preset = presets[input.preset];
  const config = siteConfigSchema.parse(preset.config({ siteName: input.name }));
  const siteType = input.siteType ?? "structured";
  return withUser(userId, async (db) => {
    const [row] = await db<{ createSite: string }[]>`
      select public.create_site(${input.organizationId}, ${input.key}, ${input.name}, ${input.preset}, ${input.timeZone}, ${input.mode},
        ${db.json({
          email: input.contact.email ?? "",
          phone: input.contact.phone ?? "",
          address: input.contact.address ?? "",
          inquiryRecipients: input.contact.inquiryRecipients ?? [],
        })}, ${db.json(config as never)}, ${siteType}::public.site_type) as create_site`;
    if (!row) throw new Error("create_site returned nothing");
    const siteId = row.createSite;
    if (siteType === "uploaded") return { siteId };
    // The creator is an organization owner; unless the site requires review, its starter pages are approved on creation (B1).
    const [policy] = await db<{ reviewRequired: boolean }[]>`select review_required from public.sites where id = ${siteId}`;
    for (const page of preset.initialPages({ siteName: input.name })) {
      const { item, revision } = await createContentItem(db, {
        siteId,
        organizationId: input.organizationId,
        kind: "page",
        payload: page.payload,
        authorId: userId,
        changeNote: "Created from preset",
      });
      if (policy && !policy.reviewRequired) await approveOnSave(db, { item, revisionId: revision.id, actorId: userId });
    }
    return { siteId };
  });
}

export async function getCurrentSiteConfig(db: Db, siteId: string): Promise<ConfigRevisionRow | null> {
  const rows = await db<ConfigRevisionRow[]>`
    select c.* from public.site_config_revisions c
    join public.sites s on s.current_config_revision_id = c.id
    where s.id = ${siteId}`;
  const row = rows[0];
  if (!row) return null;
  return { ...row, config: siteConfigSchema.parse(row.config) };
}

export async function getConfigRevision(db: Db, revisionId: string): Promise<ConfigRevisionRow | null> {
  const rows = await db<ConfigRevisionRow[]>`select * from public.site_config_revisions where id = ${revisionId}`;
  const row = rows[0];
  if (!row) return null;
  return { ...row, config: siteConfigSchema.parse(row.config) };
}

export type ConfigSaveResult = { ok: true; revision: ConfigRevisionRow } | { ok: false; conflict: true; latest: ConfigRevisionRow | null };

export async function saveSiteConfig(
  db: Db,
  input: { siteId: string; organizationId: string; baseRevisionId: string; config: unknown; authorId: string; changeNote?: string },
): Promise<ConfigSaveResult> {
  const config = siteConfigSchema.parse(input.config);
  const [site] = await db<{ currentConfigRevisionId: string | null }[]>`select current_config_revision_id from public.sites where id = ${input.siteId} for update`;
  if (!site) throw new Error("site not found");
  if (site.currentConfigRevisionId !== input.baseRevisionId) {
    return { ok: false, conflict: true, latest: await getCurrentSiteConfig(db, input.siteId) };
  }
  const [base] = await db<{ version: number }[]>`select version from public.site_config_revisions where id = ${input.baseRevisionId}`;
  const [revision] = await db<ConfigRevisionRow[]>`
    insert into public.site_config_revisions (organization_id, site_id, version, schema_version, config, change_note, author_id)
    values (${input.organizationId}, ${input.siteId}, ${(base?.version ?? 0) + 1}, 1, ${db.json(config as never)}, ${input.changeNote ?? null}, ${input.authorId})
    returning *`;
  if (!revision) throw new Error("config revision insert returned no row");
  const updated = await db`update public.sites set current_config_revision_id = ${revision.id}
    where id = ${input.siteId} and current_config_revision_id = ${input.baseRevisionId}`;
  if (updated.count !== 1) throw Object.assign(new Error("concurrent update"), { code: "40001" });
  return { ok: true, revision: { ...revision, config } };
}

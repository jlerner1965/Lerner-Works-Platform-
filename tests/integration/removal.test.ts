import { afterAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import sharp from "sharp";
import { seedInfo, withUser, endPool, adminClient, approveAll, publish, demoSnapshot } from "./helpers";
import { loadSiteContext, listOrganizations } from "@/server/data/access";
import { createSiteFromPreset } from "@/server/data/sites";
import { createContentItem } from "@/server/data/content";
import { ingestDocument, ingestUpload } from "@/server/media/ingest";
import { getStorage } from "@/server/media/storage";
import { deleteOrganization, deleteSite } from "@/server/data/removal";
import { renderSimplePdf } from "@/server/demo/documents";
import type { ReleaseSnapshot } from "@/server/publishing/snapshot";

/**
 * Removing a site or an organization (site-building programme B6, OPS-04 and OPS-05): the
 * rows go with the audit event in one transaction, the private files and the public copies
 * no other site uses go afterwards, the public route answers nothing, and the audit trail
 * remains; an organization is tombstoned with its trail. Only owners, only with the typed
 * confirmation, never a site that is live on a domain, never the last organization owned.
 */
const { users, organizations } = seedInfo();
const owner = users.owner;
const admin = adminClient();

afterAll(async () => {
  await admin.end();
  await endPool();
});

async function guide(prefix: string, organizationId = organizations.pineHollow): Promise<{ siteId: string; siteKey: string }> {
  const siteKey = `${prefix}-${Date.now().toString(36)}`;
  const { siteId } = await createSiteFromPreset(owner, { organizationId, key: siteKey, name: `Removal ${prefix}`, preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: {} });
  return { siteId, siteKey };
}

const png = async (): Promise<Uint8Array> => new Uint8Array(await sharp({ create: { width: 800, height: 600, channels: 3, background: "#2f5d3a" } }).png().toBuffer());

/** Uploads a picture (and a PDF), puts them on an article, approves and publishes; returns the assets and their public names. */
async function publishWithMedia(siteId: string, siteKey: string, image: Uint8Array, pdf: Uint8Array | null) {
  const site = (await withUser(owner, (db) => loadSiteContext(db, siteId)))!.site;
  const input = { siteId, organizationId: site.organizationId, userId: owner, license: "Owned by the client" };
  const { picture, doc } = await withUser(owner, async (db) => {
    const p = await ingestUpload(db, { ...input, bytes: image, filename: "field.png", declaredMime: "image/png", altText: "A green field", title: "Field" });
    if (!p.ok) throw new Error(p.error);
    const d = pdf ? await ingestDocument(db, { ...input, bytes: pdf, filename: "guide.pdf", declaredMime: "application/pdf", title: "Guide" }) : null;
    if (d && !d.ok) throw new Error(d.error);
    return { picture: p.asset, doc: d && d.ok ? d.asset : null };
  });
  await withUser(owner, (db) => createContentItem(db, {
    siteId, organizationId: site.organizationId, kind: "article", authorId: owner,
    payload: { title: "Field notes", slug: "field-notes", summary: "Notes from the field.", authorName: "Editors", publishedOn: "2026-09-01", featuredImageAssetId: picture.id, attachments: doc ? [{ assetId: doc.id, label: "Guide (PDF)" }] : [] },
  }));
  await approveAll(owner, siteId);
  await publish(owner, siteId, "removal test");
  const snapshot = (await demoSnapshot(siteKey))!.snapshot as unknown as ReleaseSnapshot;
  const names = (id: string): string[] => Object.values(snapshot.media[id]!.variants).map((v) => v!.path);
  return { picture, doc, pictureNames: names(picture.id), docNames: doc ? names(doc.id) : [] };
}

describe("removing a site (B6, OPS-04)", () => {
  it("deletes the rows and the files, keeps the audit trail and the public copies another site still uses, and answers nothing publicly", async () => {
    const image = await png();
    const pdf = renderSimplePdf({ title: "Guide", lines: ["Where to park."] });
    const a = await guide("rm-a");
    const b = await guide("rm-b");
    const pubA = await publishWithMedia(a.siteId, a.siteKey, image, pdf);
    const pubB = await publishWithMedia(b.siteId, b.siteKey, image, null);
    // The same bytes publish under the same content-hash names from both sites.
    expect(pubA.pictureNames).toEqual(pubB.pictureNames);
    expect(pubA.docNames).toHaveLength(1);
    const storage = getStorage();
    for (const n of [...pubA.pictureNames, ...pubA.docNames]) expect(await storage.existsPublic(n)).toBe(true);

    // Not an owner: refused. Wrong key: refused. Nothing changed either time.
    await expect(deleteSite(users.editorA, a.siteId, a.siteKey)).rejects.toMatchObject({ code: "42501" });
    await expect(deleteSite(owner, a.siteId, "wrong-key")).rejects.toMatchObject({ code: "22023" });
    expect((await admin`select count(*)::int as n from public.sites where id = ${a.siteId}`)[0]!.n).toBe(1);

    const result = await deleteSite(owner, a.siteId, a.siteKey);
    expect(result).toMatchObject({ siteId: a.siteId, key: a.siteKey, name: "Removal rm-a", organizationId: organizations.pineHollow });
    expect(result.counts).toMatchObject({ releases: 1, media: 2, members: 0, domains: 0, inquiries: 0 });
    expect(result.counts.items).toBeGreaterThanOrEqual(1);
    // Two asset folders removed; of the public copies only the PDF, because site B's release still carries the picture.
    expect(result.storage).toEqual({ assetFolders: 2, publicCopies: 1, leftovers: [] });
    for (const table of ["sites", "content_items", "releases", "media_assets", "site_config_revisions", "site_memberships", "import_jobs", "inquiries"]) {
      const rows = await admin.unsafe(`select count(*)::int as n from public.${table} where ${table === "sites" ? "id" : "site_id"} = $1`, [a.siteId]);
      expect(rows[0]!.n, table).toBe(0);
    }
    expect(await storage.getPrivate(pubA.picture.derivatives.w480!.key)).toBeNull();
    expect(await storage.getPrivate(pubA.doc!.derivatives.file!.key)).toBeNull();
    for (const n of pubA.docNames) expect(await storage.existsPublic(n)).toBe(false);
    for (const n of pubA.pictureNames) expect(await storage.existsPublic(n)).toBe(true);
    expect(await demoSnapshot(a.siteKey)).toBeNull();
    const audit = await admin`select metadata, actor_id from public.audit_events where action = 'site.deleted' and entity_id = ${a.siteId}`;
    expect(audit).toHaveLength(1);
    expect(audit[0]!.metadata).toMatchObject({ key: a.siteKey, name: "Removal rm-a", counts: { media: 2, releases: 1 } });
    expect(audit[0]!.actorId).toBe(owner);
    expect(await admin`select id from public.audit_events where action = 'site.storage_cleanup_failed' and entity_id = ${a.siteId}`).toHaveLength(0);

    // With site B gone as well, nobody carries the picture's copies any more.
    const second = await deleteSite(owner, b.siteId, b.siteKey);
    expect(second.storage.publicCopies).toBe(pubB.pictureNames.length);
    for (const n of pubB.pictureNames) expect(await storage.existsPublic(n)).toBe(false);
  });

  it("refuses a site that is live on a domain until it is taken off", async () => {
    const c = await guide("rm-c");
    const site = (await withUser(owner, (db) => loadSiteContext(db, c.siteId)))!.site;
    await admin`insert into public.domains (organization_id, site_id, normalized_host, status, is_canonical, verified_at) values (${site.organizationId}, ${c.siteId}, ${`${c.siteKey}.example`}, 'active', true, now())`;
    await expect(deleteSite(owner, c.siteId, c.siteKey)).rejects.toThrow(/live on a domain/);
    expect((await admin`select count(*)::int as n from public.sites where id = ${c.siteId}`)[0]!.n).toBe(1);
    await admin`update public.domains set status = 'disabled' where site_id = ${c.siteId}`;
    const result = await deleteSite(owner, c.siteId, c.siteKey);
    expect(result.counts.domains).toBe(1);
    expect((await admin`select count(*)::int as n from public.domains where site_id = ${c.siteId}`)[0]!.n).toBe(0);
  });
});

describe("removing an organization (B6, OPS-05)", () => {
  it("deletes its sites, memberships and invitations, leaves a tombstone with the audit trail, and refuses non-owners, a wrong name and the last organization owned", async () => {
    const name = `Removal Org ${Date.now().toString(36)}`;
    const orgId = (await withUser(owner, (db) => db<{ id: string }[]>`select public.create_organization(${name}) as id`))[0]!.id;
    const s1 = await guide("rm-o1", orgId);
    const s2 = await guide("rm-o2", orgId);
    await admin`insert into public.invitations (organization_id, email, organization_role, site_assignments, token_hash, expires_at, created_by) values (${orgId}, 'invitee@fixture.example', 'member', '[]'::jsonb, ${crypto.randomBytes(32).toString("hex")}, now() + interval '7 days', ${owner})`;

    // A member of another organization, a wrong name: refused, and both sites stay.
    await expect(deleteOrganization(users.publisherB, orgId, name)).rejects.toMatchObject({ code: "42501" });
    await expect(deleteOrganization(owner, orgId, "Wrong name")).rejects.toMatchObject({ code: "22023" });
    expect((await admin`select count(*)::int as n from public.sites where organization_id = ${orgId}`)[0]!.n).toBe(2);

    const result = await deleteOrganization(owner, orgId, name);
    expect(result.sites.map((s) => s.key).sort()).toEqual([s1.siteKey, s2.siteKey].sort());
    expect(result).toMatchObject({ name, members: 1, invitations: 1 });
    expect((await admin`select count(*)::int as n from public.sites where organization_id = ${orgId}`)[0]!.n).toBe(0);
    expect((await admin`select count(*)::int as n from public.memberships where organization_id = ${orgId}`)[0]!.n).toBe(0);
    expect((await admin`select count(*)::int as n from public.invitations where organization_id = ${orgId}`)[0]!.n).toBe(0);
    const org = (await admin`select status, deleted_by, deleted_at, name from public.organizations where id = ${orgId}`)[0]!;
    expect(org).toMatchObject({ status: "deleted", deletedBy: owner, name });
    expect(org.deletedAt).not.toBeNull();
    // Nothing of it is reachable through the application role, and the trail of what happened remains.
    expect((await listOrganizations(owner)).some((o) => o.id === orgId)).toBe(false);
    expect(await withUser(owner, (db) => db`select id from public.organizations where id = ${orgId}`)).toHaveLength(0);
    const actions = (await admin`select action from public.audit_events where organization_id = ${orgId} order by created_at`).map((r) => r.action as string);
    expect(actions).toEqual(expect.arrayContaining(["organization.created", "site.created", "site.deleted", "organization.deleted"]));
    expect(actions.filter((x) => x === "site.deleted")).toHaveLength(2);
    expect(actions[actions.length - 1]).toBe("organization.deleted");

    // The last organization a person owns cannot be deleted: only an existing owner can create the next one.
    const lastName = `Only Org ${Date.now().toString(36)}`;
    const lastId = (await admin`insert into public.organizations (name) values (${lastName}) returning id`)[0]!.id as string;
    await admin`insert into public.memberships (organization_id, user_id, organization_role) values (${lastId}, ${users.stranger}, 'owner')`;
    await expect(deleteOrganization(users.stranger, lastId, lastName)).rejects.toThrow(/last organization you own/);
    expect((await admin`select status from public.organizations where id = ${lastId}`)[0]!.status).toBe("active");
  });
});

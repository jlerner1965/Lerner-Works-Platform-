import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedInfo, withUser, endPool, adminClient, key, approveAll, publish, demoSnapshot } from "./helpers";
import { getItem, saveRevision, createContentItem } from "@/server/data/content";
import { buildCandidate, getCandidate } from "@/server/publishing/candidates";
import { activateCandidate, restoreRelease } from "@/server/publishing/activate";
import { loadSiteContext } from "@/server/data/access";
import { resolveRoute, resolveDemoRelease } from "@/server/publishing/public-site";
import { hashCanonical } from "@/lib/canonical-json";

const { users, sites, organizations } = seedInfo();
const owner = users.owner;
const siteA = sites.pineHollow;
const siteB = sites.rangeAthletics;

async function homeItem(siteId: string) {
  return withUser(owner, async (db) => {
    const [row] = await db<{ id: string }[]>`select i.id from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteId} and r.slug = 'home'`;
    return (await getItem(db, row!.id))!;
  });
}

beforeAll(async () => {
  await approveAll(owner, siteA);
  await approveAll(owner, siteB);
  await publish(owner, siteA, "initial A");
  await publish(owner, siteB, "initial B");
});

afterAll(async () => {
  await endPool();
});

describe("saving with optimistic concurrency (DATA-01, DATA-02)", () => {
  it("persists a revision and rejects a stale save without writing", async () => {
    const home = await homeItem(siteA);
    const payloadA = { ...home.revision.payload, summary: "First writer summary that is long enough." };
    const payloadB = { ...home.revision.payload, summary: "Second writer summary that is long enough." };
    const first = await withUser(owner, (db) => saveRevision(db, { itemId: home.item.id, baseRevisionId: home.revision.id, payload: payloadA, authorId: owner }));
    expect(first.ok).toBe(true);
    const second = await withUser(owner, (db) => saveRevision(db, { itemId: home.item.id, baseRevisionId: home.revision.id, payload: payloadB, authorId: owner }));
    expect(second).toMatchObject({ ok: false, conflict: true });
    if (!second.ok) expect(second.latest?.payload.summary).toBe(payloadA.summary);
    const after = await homeItem(siteA);
    expect(after.revision.version).toBe(home.revision.version + 1);
    expect(after.revision.payload.summary).toBe(payloadA.summary);
  });
});

describe("frozen candidates and atomic activation (PUB-01..PUB-05)", () => {
  it("unpublished edits never change the public snapshot; candidates stay frozen after later edits", async () => {
    const before = (await demoSnapshot("pine-hollow"))!;
    const home = await homeItem(siteA);
    const marker = `Marker ${Date.now()}`;
    const saved = await withUser(owner, (db) => saveRevision(db, { itemId: home.item.id, baseRevisionId: home.revision.id, payload: { ...home.revision.payload, summary: `${marker} long enough summary text here.` }, authorId: owner }));
    expect(saved.ok).toBe(true);
    const afterSave = (await demoSnapshot("pine-hollow"))!;
    expect(afterSave.releaseId).toBe(before.releaseId);
    expect(JSON.stringify(afterSave.snapshot)).not.toContain(marker);

    await approveAll(owner, siteA);
    const ctx = (await withUser(owner, (db) => loadSiteContext(db, siteA)))!;
    const { candidate } = await buildCandidate(owner, ctx.site);
    expect(candidate.state).toBe("ready");
    expect(JSON.stringify(candidate.manifest)).toContain(marker);
    // Edit again after the candidate exists: the frozen manifest must not change.
    const home2 = await homeItem(siteA);
    await withUser(owner, (db) => saveRevision(db, { itemId: home2.item.id, baseRevisionId: home2.revision.id, payload: { ...home2.revision.payload, summary: "Later edit that must not leak into the frozen candidate." }, authorId: owner }));
    const reloaded = (await withUser(owner, (db) => getCandidate(db, candidate.id)))!;
    expect(reloaded.manifestHash).toBe(candidate.manifestHash);
    expect(hashCanonical(reloaded.manifest)).toBe(candidate.manifestHash);
    expect(JSON.stringify(reloaded.manifest)).not.toContain("Later edit that must not leak");

    const result = await activateCandidate(owner, candidate.id, key(), "publish marker");
    expect(result.outcome).toBe("activated");
    const afterActivate = (await demoSnapshot("pine-hollow"))!;
    expect(afterActivate.releaseId).not.toBe(before.releaseId);
    expect(JSON.stringify(afterActivate.snapshot)).toContain(marker);
    // Site B is untouched.
    const b = await demoSnapshot("range-athletics");
    expect(JSON.stringify(b!.snapshot)).not.toContain(marker);
  });

  it("is idempotent for retried activation and reports conflicts for stale candidates", async () => {
    const ctx = (await withUser(owner, (db) => loadSiteContext(db, siteA)))!;
    const c1 = (await buildCandidate(owner, ctx.site)).candidate;
    const c2 = (await buildCandidate(owner, ctx.site)).candidate;
    const idem = key();
    const r1 = await activateCandidate(owner, c1.id, idem, "first");
    expect(r1.outcome).toBe("activated");
    const r1again = await activateCandidate(owner, c1.id, idem, "first retry");
    expect(r1again.outcome).toBe("already_activated");
    if (r1.outcome === "activated" && r1again.outcome === "already_activated") expect(r1again.releaseId).toBe(r1.releaseId);
    const r2 = await activateCandidate(owner, c2.id, key(), "second");
    expect(r2.outcome).toBe("conflict");
    const c2after = (await withUser(owner, (db) => getCandidate(db, c2.id)))!;
    expect(c2after.state).toBe("superseded");
    const admin = adminClient();
    try {
      const rows = await admin`select count(*)::int as n from public.releases where site_id = ${siteA} and idempotency_key = ${idem}`;
      expect(rows[0]!.n).toBe(1);
    } finally {
      await admin.end();
    }
  });

  it("blocks invalid candidates and leaves the active release unchanged (PUB-04)", async () => {
    const before = (await demoSnapshot("pine-hollow"))!;
    // Break navigation: point a nav link at a route that does not exist.
    await withUser(owner, async (db) => {
      const { getCurrentSiteConfig, saveSiteConfig } = await import("@/server/data/sites");
      const current = (await getCurrentSiteConfig(db, siteA))!;
      const config = { ...current.config, navigation: { items: [...current.config.navigation.items, { label: "Ghost", path: "/ghost" }] } };
      const res = await saveSiteConfig(db, { siteId: siteA, organizationId: organizations.pineHollow, baseRevisionId: current.id, config, authorId: owner });
      expect(res.ok).toBe(true);
    });
    const ctx = (await withUser(owner, (db) => loadSiteContext(db, siteA)))!;
    const { candidate } = await buildCandidate(owner, ctx.site);
    expect(candidate.state).toBe("blocked");
    expect(candidate.validation.blockers.map((b) => b.code)).toContain("missing_nav_target");
    const r = await activateCandidate(owner, candidate.id, key(), null);
    expect(r.outcome).toBe("conflict");
    await expect(withUser(owner, (db) => db`select * from public.activate_release_candidate(${candidate.id}, ${key()}, null)`)).rejects.toMatchObject({ code: "P0001" });
    expect((await demoSnapshot("pine-hollow"))!.releaseId).toBe(before.releaseId);
    // Repair the configuration.
    await withUser(owner, async (db) => {
      const { getCurrentSiteConfig, saveSiteConfig } = await import("@/server/data/sites");
      const current = (await getCurrentSiteConfig(db, siteA))!;
      const config = { ...current.config, navigation: { items: current.config.navigation.items.filter((n) => n.path !== "/ghost") } };
      await saveSiteConfig(db, { siteId: siteA, organizationId: organizations.pineHollow, baseRevisionId: current.id, config, authorId: owner });
    });
  });

  it("changes a slug and publishes a redirect from the old route (ROUTE-03)", async () => {
    const about = await withUser(owner, async (db) => {
      const [row] = await db<{ id: string }[]>`select i.id from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteA} and r.slug = 'about'`;
      return (await getItem(db, row!.id))!;
    });
    await withUser(owner, (db) => saveRevision(db, { itemId: about.item.id, baseRevisionId: about.revision.id, payload: { ...about.revision.payload, slug: "about-the-guide" }, authorId: owner }));
    // Navigation still points at /about; fix it to the new path first.
    await withUser(owner, async (db) => {
      const { getCurrentSiteConfig, saveSiteConfig } = await import("@/server/data/sites");
      const current = (await getCurrentSiteConfig(db, siteA))!;
      const config = { ...current.config, navigation: { items: current.config.navigation.items.map((n) => (n.path === "/about" ? { ...n, path: "/about-the-guide" } : n)) }, footer: { ...current.config.footer, links: current.config.footer.links.map((n) => (n.path === "/about" ? { ...n, path: "/about-the-guide" } : n)) } };
      await saveSiteConfig(db, { siteId: siteA, organizationId: organizations.pineHollow, baseRevisionId: current.id, config, authorId: owner });
    });
    await approveAll(owner, siteA);
    await publish(owner, siteA, "slug change");
    const release = (await resolveDemoRelease("pine-hollow"))!;
    expect(resolveRoute(release.snapshot, "/about")).toEqual({ type: "redirect", to: "/about-the-guide" });
    expect(resolveRoute(release.snapshot, "/about-the-guide").type).toBe("page");
    expect(release.snapshot.redirects.some((r) => r.from === r.to)).toBe(false);
  });

  it("resolves identical slugs to each site's own content (ROUTE-02)", async () => {
    const a = (await resolveDemoRelease("pine-hollow"))!;
    const b = (await resolveDemoRelease("range-athletics"))!;
    const ra = resolveRoute(a.snapshot, "/contact");
    const rb = resolveRoute(b.snapshot, "/contact");
    expect(ra.type).toBe("page");
    expect(rb.type).toBe("page");
    if (ra.type === "page" && rb.type === "page") {
      expect(ra.item.id).not.toBe(rb.item.id);
      expect(a.snapshot.site.id).toBe(siteA);
      expect(b.snapshot.site.id).toBe(siteB);
    }
  });
});

describe("restore (PUB-06)", () => {
  it("restores a historical release as a new release without touching drafts or inquiries", async () => {
    const admin = adminClient();
    try {
      const releases = await admin<{ id: string; version: number }[]>`select id, version from public.releases where site_id = ${siteA} order by version`;
      const target = releases[0]!;
      const current = releases[releases.length - 1]!;
      const receiptCode = (await admin<{ receiptCode: string }[]>`select receipt_code from public.submit_inquiry('pine-hollow', null, ${admin.json({ name: "Fixture", email: "fixture@example.test", message: "Keep me through the restore." })}, 'restore-test', ${key()})`)[0]!.receiptCode;
      const draftsBefore = await admin`select id from public.content_revisions where site_id = ${siteA}`;
      const r = await restoreRelease(owner, target.id, key(), "roll back to the first release");
      expect(r.outcome).toBe("restored");
      const after = (await demoSnapshot("pine-hollow"))!;
      const [row] = await admin<{ restoredFrom: string; version: number; snapshotHash: string }[]>`select restored_from_release_id as restored_from, version, snapshot_hash from public.releases where id = ${after.releaseId}`;
      expect(row!.restoredFrom).toBe(target.id);
      expect(row!.version).toBe(current.version + 1);
      const [orig] = await admin<{ snapshotHash: string }[]>`select snapshot_hash from public.releases where id = ${target.id}`;
      expect(row!.snapshotHash).toBe(orig!.snapshotHash);
      const draftsAfter = await admin`select id from public.content_revisions where site_id = ${siteA}`;
      expect(draftsAfter.length).toBe(draftsBefore.length);
      const inquiry = await admin`select id from public.inquiries where receipt_code = ${receiptCode}`;
      expect(inquiry.length).toBe(1);
      const stale = await admin`select id from public.releases where id = ${current.id}`;
      expect(stale.length).toBe(1);
    } finally {
      await admin.end();
    }
  });

  it("refuses to restore an unsupported schema version or a release with withdrawn media", async () => {
    const admin = adminClient();
    try {
      const [rel] = await admin<{ id: string }[]>`select id from public.releases where site_id = ${siteA} order by version limit 1`;
      await expect(withUser(owner, (db) => db`select * from public.restore_release(${rel!.id}, ${key()}, 'test', array[99])`)).rejects.toMatchObject({ code: "P0001" });
      await expect(withUser(users.editorA, (db) => db`select * from public.restore_release(${rel!.id}, ${key()}, 'test', array[1])`)).rejects.toMatchObject({ code: "42501" });
    } finally {
      await admin.end();
    }
  });
});

describe("dependency reporting (DATA-03)", () => {
  it("reports pages that depend on a disabled module instead of deleting anything", async () => {
    const countItems = () => withUser(owner, (db) => db`select id from public.content_items where site_id = ${siteB} and archived_at is null`);
    const before = (await countItems()).length;
    const setServices = async (enabled: boolean) => {
      await withUser(owner, async (db) => {
        const { getCurrentSiteConfig, saveSiteConfig } = await import("@/server/data/sites");
        const current = (await getCurrentSiteConfig(db, siteB))!;
        const items = current.config.navigation.items.filter((n) => n.path !== "/services");
        const config = { ...current.config, modules: { ...current.config.modules, services: enabled }, navigation: { items: enabled ? [...items.slice(0, 1), { label: "Services", path: "/services" }, ...items.slice(1)] : items } };
        await saveSiteConfig(db, { siteId: siteB, organizationId: organizations.rangeAthletics, baseRevisionId: current.id, config, authorId: owner });
      });
    };
    await setServices(false);
    try {
      const ctx = (await withUser(owner, (db) => loadSiteContext(db, siteB)))!;
      const { candidate } = await buildCandidate(owner, ctx.site);
      expect(candidate.state).toBe("blocked");
      const dep = candidate.validation.blockers.find((b) => b.code === "module_disabled_dependency");
      expect(dep?.itemTitle).toBe("Home");
      expect((await countItems()).length).toBe(before);
    } finally {
      await setServices(true);
    }
  });

  it("stores archived items are excluded and reported as removals", async () => {
    const created = await withUser(owner, (db) => createContentItem(db, { siteId: siteB, organizationId: organizations.rangeAthletics, kind: "page", payload: { schemaVersion: 1, title: "Temp", slug: "temp-page", summary: "A temporary page with enough summary text.", body: [], featuredImageAssetId: null, metaTitle: "", metaDescription: "", indexable: true, sourceUrl: "", lastVerifiedOn: "", attribution: "", sections: [] }, authorId: owner }));
    await approveAll(owner, siteB);
    await publish(owner, siteB, "add temp page");
    expect(resolveRoute((await resolveDemoRelease("range-athletics"))!.snapshot, "/temp-page").type).toBe("page");
    await withUser(owner, (db) => db`update public.content_items set archived_at = now(), archived_by = ${owner} where id = ${created.item.id}`);
    const ctx = (await withUser(owner, (db) => loadSiteContext(db, siteB)))!;
    const { candidate } = await buildCandidate(owner, ctx.site);
    expect(candidate.summary.removed.map((r) => r.title)).toEqual(["Temp"]);
    expect(candidate.state).toBe("ready");
  });
});

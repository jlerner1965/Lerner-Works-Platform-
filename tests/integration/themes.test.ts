import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { strFromU8, unzipSync, zipSync } from "fflate";
import { createHash } from "node:crypto";
import { seedInfo, withUser, endPool, adminClient, key, approveAll, publish, demoSnapshot } from "./helpers";
import { loadSiteContext } from "@/server/data/access";
import { getCurrentSiteConfig, saveSiteConfig } from "@/server/data/sites";
import { buildCandidate } from "@/server/publishing/candidates";
import { restoreRelease } from "@/server/publishing/activate";
import { resolveDemoRelease, resolveRoute } from "@/server/publishing/public-site";
import { makeRenderContext } from "@/server/publishing/render";
import { normalizeSnapshot, type ReleaseSnapshot } from "@/server/publishing/snapshot";
import { loadDesignPreview } from "@/server/publishing/design-preview";
import { exportSitePackage, dryRunPackage } from "@/server/import/package";

const { users, sites, organizations } = seedInfo();
const owner = users.owner;
const siteA = sites.pineHollow;
const siteB = sites.rangeAthletics;

// The settings actions read the signed-in user from the request; tests switch the user per call.
let currentUser = owner;
vi.mock("@/server/auth/session", () => ({
  requireUser: async () => ({ id: currentUser, email: "test@lernerworks.example" }),
  getSessionUser: async () => ({ id: currentUser, email: "test@lernerworks.example" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`); } }));

async function renderHome(snapshot: ReleaseSnapshot, siteKey: string): Promise<string> {
  const { getTheme } = await import("@/themes");
  const basePath = `/demo/${siteKey}`;
  const now = new Date("2026-09-26T12:00:00Z");
  const ctx = makeRenderContext({ snapshot, basePath, mode: "demo", path: "/", query: {}, inquiryEndpoint: `${basePath}/inquiries`, releaseVersion: 1, publishedAt: now, now });
  return renderToStaticMarkup(getTheme(snapshot).render(ctx, resolveRoute(snapshot, "/")));
}

/** A Design card submission with the current design and the given changes. */
async function designForm(siteId: string, changes: Record<string, string>): Promise<FormData> {
  const current = (await withUser(owner, (db) => getCurrentSiteConfig(db, siteId)))!;
  const d = current.config.design;
  const form = new FormData();
  form.set("siteId", siteId);
  form.set("baseRevisionId", current.id);
  for (const [k, v] of Object.entries({ theme: d.theme, header: d.header, hero: d.hero, cards: d.cards, radius: d.radius, density: d.density, container: d.container, ...changes })) form.set(k, v);
  for (const [k, v] of Object.entries(d.overrides)) form.set(`override_${k}`, v);
  return form;
}

beforeAll(async () => {
  await approveAll(owner, siteA);
  await approveAll(owner, siteB);
  await publish(owner, siteA, "themes baseline A").catch(() => undefined);
  await publish(owner, siteB, "themes baseline B").catch(() => undefined);
});

afterAll(async () => {
  currentUser = owner;
  await endPool();
});

describe("switching a site's theme and back (DES-10)", () => {
  it("publishes the new composition, keeps earlier releases rendering as published, restores, and switches back identically", async () => {
    const { saveDesignAction } = await import("@/server/actions/settings");
    const before = (await demoSnapshot("pine-hollow"))!;
    const beforeSnapshot = normalizeSnapshot(before.snapshot)!;
    expect(await renderHome(beforeSnapshot, "pine-hollow")).toContain("guide-theme");

    // The switch is a configuration revision with notes; the public site does not change yet.
    currentUser = owner;
    const switched = await saveDesignAction({}, await designForm(siteA, { theme: "magazine" }));
    expect(switched.error).toBeUndefined();
    expect(switched.notes?.some((n) => n.includes("Theme changed to Magazine"))).toBe(true);
    expect((await demoSnapshot("pine-hollow"))!.releaseId).toBe(before.releaseId);

    // The design preview already shows the draft theme over the active release.
    const ctxA = (await withUser(owner, (db) => loadSiteContext(db, siteA)))!;
    const preview = (await withUser(owner, (db) => loadDesignPreview(db, ctxA.site)))!;
    expect(preview.release.id).toBe(before.releaseId);
    expect(preview.snapshot.config.design.theme).toBe("magazine");
    expect(await renderHome(preview.snapshot, "pine-hollow")).toContain("magazine-theme");

    // Publish: the new composition is live; the earlier release still renders as it was.
    const afterSwitch = await publish(owner, siteA, "switch to magazine");
    const live = (await resolveDemoRelease("pine-hollow"))!;
    expect(live.snapshot.config.design.theme).toBe("magazine");
    expect(live.snapshot.schemaVersion).toBe(5);
    expect(await renderHome(live.snapshot, "pine-hollow")).toContain("magazine-theme");
    expect(await renderHome(beforeSnapshot, "pine-hollow")).toContain("guide-theme");

    // Restore the earlier release: the guide composition is back without any configuration change.
    const restored = await restoreRelease(owner, before.releaseId, key(), "back to the guide composition");
    expect(restored.outcome).toBe("restored");
    const restoredLive = (await resolveDemoRelease("pine-hollow"))!;
    expect(restoredLive.releaseId).not.toBe(afterSwitch.releaseId);
    expect(await renderHome(restoredLive.snapshot, "pine-hollow")).toContain("guide-theme");
    const admin = adminClient();
    try {
      const [orig] = await admin<{ snapshotHash: string }[]>`select snapshot_hash from public.releases where id = ${before.releaseId}`;
      const [back] = await admin<{ snapshotHash: string }[]>`select snapshot_hash from public.releases where id = ${restoredLive.releaseId}`;
      expect(back!.snapshotHash).toBe(orig!.snapshotHash);
    } finally {
      await admin.end();
    }

    // Switch the configuration back to the preset default and publish: identical to the earlier composition.
    const back = await saveDesignAction({}, await designForm(siteA, { theme: "default" }));
    expect(back.error).toBeUndefined();
    await publish(owner, siteA, "back to default");
    const finalLive = (await resolveDemoRelease("pine-hollow"))!;
    expect(finalLive.snapshot.config.design.theme).toBe("default");
    expect(await renderHome(finalLive.snapshot, "pine-hollow")).toBe(await renderHome({ ...beforeSnapshot, config: finalLive.snapshot.config, configRevisionId: finalLive.snapshot.configRevisionId } as ReleaseSnapshot, "pine-hollow"));
  });

  it("switches to the B3 compositions (almanac for the guide, practice for the location business) and back", async () => {
    const { saveDesignAction } = await import("@/server/actions/settings");
    currentUser = owner;
    const toAlmanac = await saveDesignAction({}, await designForm(siteA, { theme: "almanac" }));
    expect(toAlmanac.error).toBeUndefined();
    expect(toAlmanac.notes?.some((n) => n.includes("Theme changed to Almanac"))).toBe(true);
    await publish(owner, siteA, "switch to almanac");
    const liveA = (await resolveDemoRelease("pine-hollow"))!;
    expect(liveA.snapshot.config.design.theme).toBe("almanac");
    const htmlA = await renderHome(liveA.snapshot, "pine-hollow");
    expect(htmlA).toContain("almanac-theme");
    expect(htmlA).toContain("alm-heading");
    expect((await saveDesignAction({}, await designForm(siteA, { theme: "default" }))).error).toBeUndefined();
    await publish(owner, siteA, "back to the guide composition");
    expect(await renderHome((await resolveDemoRelease("pine-hollow"))!.snapshot, "pine-hollow")).toContain("guide-theme");

    const toPractice = await saveDesignAction({}, await designForm(siteB, { theme: "practice" }));
    expect(toPractice.error).toBeUndefined();
    expect(toPractice.notes?.some((n) => n.includes("Theme changed to Practice"))).toBe(true);
    await publish(owner, siteB, "switch to practice");
    const liveB = (await resolveDemoRelease("range-athletics"))!;
    expect(liveB.snapshot.config.design.theme).toBe("practice");
    const htmlB = await renderHome(liveB.snapshot, "range-athletics");
    expect(htmlB).toContain("practice-theme");
    expect(htmlB).toContain("Location details");
    expect((await saveDesignAction({}, await designForm(siteB, { theme: "default" }))).error).toBeUndefined();
    await publish(owner, siteB, "back to the retail composition");
    expect(await renderHome((await resolveDemoRelease("range-athletics"))!.snapshot, "range-athletics")).toContain("locations-theme");
  });

  it("refuses a theme written for another preset on save, at publication and on package import", async () => {
    const { saveDesignAction } = await import("@/server/actions/settings");
    currentUser = owner;
    const result = await saveDesignAction({}, await designForm(siteA, { theme: "storefront" }));
    expect(result.error).toBeDefined();
    expect(result.fieldErrors?.["design.theme"]).toContain("not written for this site's preset");

    // The data layer accepts the value (the schema knows the key); publication is blocked.
    const before = (await demoSnapshot("pine-hollow"))!;
    await withUser(owner, async (db) => {
      const current = (await getCurrentSiteConfig(db, siteA))!;
      const config = structuredClone(current.config);
      config.design.theme = "storefront";
      const saved = await saveSiteConfig(db, { siteId: siteA, organizationId: organizations.pineHollow, baseRevisionId: current.id, config, authorId: owner });
      expect(saved.ok).toBe(true);
    });
    const ctxA = (await withUser(owner, (db) => loadSiteContext(db, siteA)))!;
    const { candidate } = await buildCandidate(owner, ctxA.site);
    expect(candidate.state).toBe("blocked");
    expect(candidate.validation.blockers.map((b) => b.code)).toContain("theme_unsupported");
    expect((await demoSnapshot("pine-hollow"))!.releaseId).toBe(before.releaseId);
    // Repair.
    await withUser(owner, async (db) => {
      const current = (await getCurrentSiteConfig(db, siteA))!;
      const config = structuredClone(current.config);
      config.design.theme = "default";
      await saveSiteConfig(db, { siteId: siteA, organizationId: organizations.pineHollow, baseRevisionId: current.id, config, authorId: owner });
    });

    // A package whose configuration names the wrong theme is refused in the dry run.
    const zip = await withUser(owner, async (db) => exportSitePackage(db, (await loadSiteContext(db, siteA))!.site));
    const entries = unzipSync(zip);
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]!)) as { files: Array<{ path: string; sha256: string }> };
    const cfg = JSON.parse(strFromU8(entries["site-config.json"]!)) as { design: { theme: string } };
    cfg.design.theme = "storefront";
    entries["site-config.json"] = new TextEncoder().encode(JSON.stringify(cfg));
    manifest.files = manifest.files.map((f) => (f.path === "site-config.json" ? { ...f, sha256: createHash("sha256").update(entries["site-config.json"]!).digest("hex") } : f));
    entries["manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest));
    const dry = await withUser(owner, async (db) => dryRunPackage(db, (await loadSiteContext(db, siteA))!.site, zipSync(entries)));
    expect(dry.errors.some((e) => e.includes("site-config.json") && e.includes("not written for this site's preset"))).toBe(true);
  });
});

describe("design controls belong to owners unless delegated (DES-11)", () => {
  it("refuses a publisher without delegation in the action and in the database, allows them once delegated, and never editors or reviewers", async () => {
    const { saveDesignAction, setDesignDelegationAction } = await import("@/server/actions/settings");
    const capsOf = (userId: string) => withUser(userId, async (db) => (await loadSiteContext(db, siteB))!.capabilities);
    expect((await capsOf(users.publisherB)).canDesign).toBe(false);

    // Action: refused for the publisher.
    currentUser = users.publisherB;
    const refused = await saveDesignAction({}, await designForm(siteB, { radius: "medium" }));
    expect(refused.error).toContain("organization owner");

    // Database: a configuration revision that changes the design is refused for the publisher even without the action.
    await expect(
      withUser(users.publisherB, async (db) => {
        const current = (await getCurrentSiteConfig(db, siteB))!;
        const config = structuredClone(current.config);
        config.design.radius = "large";
        return saveSiteConfig(db, { siteId: siteB, organizationId: organizations.rangeAthletics, baseRevisionId: current.id, config, authorId: users.publisherB });
      }),
    ).rejects.toMatchObject({ code: "42501" });
    // ...while the same publisher may still change other settings.
    const otherSettings = await withUser(users.publisherB, async (db) => {
      const current = (await getCurrentSiteConfig(db, siteB))!;
      const config = structuredClone(current.config);
      config.footer.text = "Publisher-edited footer text.";
      return saveSiteConfig(db, { siteId: siteB, organizationId: organizations.rangeAthletics, baseRevisionId: current.id, config, authorId: users.publisherB });
    });
    expect(otherSettings.ok).toBe(true);

    // Delegation is the owner's switch only, and it is audited.
    const delegateForm = new FormData();
    delegateForm.set("siteId", siteB);
    delegateForm.set("delegated", "on");
    currentUser = users.publisherB;
    expect((await setDesignDelegationAction({}, delegateForm)).error).toContain("owners");
    await expect(withUser(users.publisherB, (db) => db`select public.set_design_delegation(${siteB}, true)`)).rejects.toMatchObject({ code: "42501" });
    currentUser = owner;
    expect((await setDesignDelegationAction({}, delegateForm)).message).toContain("delegated");
    expect((await capsOf(users.publisherB)).canDesign).toBe(true);
    const admin = adminClient();
    try {
      const audit = await admin`select id from public.audit_events where site_id = ${siteB} and action = 'design.delegation_changed'`;
      expect(audit.length).toBeGreaterThanOrEqual(1);
    } finally {
      await admin.end();
    }

    // With delegation, the publisher's design change goes through the action and the database.
    currentUser = users.publisherB;
    const allowed = await saveDesignAction({}, await designForm(siteB, { radius: "medium" }));
    expect(allowed.error).toBeUndefined();
    expect((await withUser(owner, (db) => getCurrentSiteConfig(db, siteB)))!.config.design.radius).toBe("medium");

    // Editors and reviewers never: the action refuses and the design preview loader is behind canDesign.
    currentUser = users.editorA;
    const editorTry = await saveDesignAction({}, await designForm(siteA, { radius: "medium" }));
    expect(editorTry.error).toBeDefined();
    expect((await withUser(users.editorA, async (db) => (await loadSiteContext(db, siteA))!.capabilities)).canDesign).toBe(false);
    expect((await withUser(users.reviewerA, async (db) => (await loadSiteContext(db, siteA))!.capabilities)).canDesign).toBe(false);

    // Switch delegation off again and put the radius back.
    currentUser = owner;
    const offForm = new FormData();
    offForm.set("siteId", siteB);
    expect((await setDesignDelegationAction({}, offForm)).message).toContain("only organization owners");
    expect((await capsOf(users.publisherB)).canDesign).toBe(false);
    await saveDesignAction({}, await designForm(siteB, { radius: "small" }));
  });
});

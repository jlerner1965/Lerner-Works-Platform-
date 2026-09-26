import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { seedInfo, withUser, endPool, publish, demoSnapshot } from "./helpers";
import { loadSiteContext } from "@/server/data/access";
import { createSiteFromPreset } from "@/server/data/sites";
import { dryRunOnboarding, applyOnboarding } from "@/server/import/onboarding";
import { buildProofPackage, proofPhotoDir, proofPhotoProblems, proofSites } from "@/server/demo/proof";
import { resolveRoute } from "@/server/publishing/public-site";
import { makeRenderContext } from "@/server/publishing/render";
import { normalizeSnapshot, type ReleaseSnapshot } from "@/server/publishing/snapshot";
import { themesForPreset } from "@/themes/capabilities";
import { getTheme } from "@/themes";

/**
 * Site-building programme B4: the two proof sites' onboarding packages (real photography,
 * realistic content) take a fresh site of each preset to a first release through the real
 * import and publishing services, and every composition written for the preset renders the
 * result without a placeholder notice. The timed dashboard build is tests/e2e/proof.spec.ts;
 * this is the package's own correctness, run on every gate.
 */
const { users, organizations } = seedInfo();
const owner = users.owner;
const now = new Date("2026-09-26T12:00:00Z");

afterAll(async () => {
  await endPool();
});

/** Text as React's static markup escapes it. */
const html = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

function render(snapshot: ReleaseSnapshot, siteKey: string, routePath: string, theme: string): string {
  const themed = { ...snapshot, config: { ...snapshot.config, design: { ...snapshot.config.design, theme } } } as ReleaseSnapshot;
  const basePath = `/demo/${siteKey}`;
  const ctx = makeRenderContext({ snapshot: themed, basePath, mode: "demo", path: routePath, query: {}, inquiryEndpoint: `${basePath}/inquiries`, releaseVersion: 1, publishedAt: now, now });
  return renderToStaticMarkup(getTheme(themed).render(ctx, resolveRoute(themed, routePath)));
}

describe("the proof sites' packages reach a first release on a fresh site (B4)", () => {
  for (const proof of proofSites) {
    it(`${proof.name}: the package dry-runs clean, imports in one step, publishes and renders under every composition`, async () => {
      expect(proofPhotoProblems(proof)).toEqual([]);
      const dir = proofPhotoDir(proof.key);
      const bytes = await buildProofPackage(proof, (file) => new Uint8Array(fs.readFileSync(path.join(dir, file))));
      const key = `proof-${proof.key}-${Date.now().toString(36)}`;
      const { siteId } = await createSiteFromPreset(owner, { organizationId: organizations.pineHollow, key, name: proof.name, preset: proof.preset, timeZone: proof.timeZone, mode: "demo", contact: { email: proof.contactEmail } });
      const site = await withUser(owner, async (db) => (await loadSiteContext(db, siteId))!.site);

      const dry = await withUser(owner, (db) => dryRunOnboarding(db, site, bytes, { canApplySettings: true }));
      expect(dry.errors).toEqual([]);
      expect(dry.settings.problems).toEqual([]);
      expect(dry.warnings.filter((w) => !w.includes("already has content"))).toEqual([]);
      expect(dry.summary.rowErrors).toBe(0);
      const rows = Object.values(proof.rows).reduce((n, r) => n + (r?.length ?? 0), 0);
      expect(dry.summary).toMatchObject({ items: rows, images: proof.artwork.length + proof.photos.length, settings: Object.keys(proof.settings).length });
      expect(dry.images.every((i) => i.alt.trim().length > 0 && i.license.length > 0)).toBe(true);

      const applied = await withUser(owner, (db) => applyOnboarding(db, site, owner, dry, { approve: true, applySettings: true }));
      expect(applied).toMatchObject({ created: rows, updated: 0, skipped: 0, images: proof.artwork.length + proof.photos.length, approved: true, pages: ["home", "about"] });

      // One publish, no blockers: the package left nothing for the owner to repair.
      await publish(owner, siteId, "first release from the package");
      const live = (await demoSnapshot(key))!;
      const snapshot = normalizeSnapshot(live.snapshot)!;
      const home = Object.values(snapshot.items).find((i) => i.kind === "page" && i.payload.slug === "home")!;
      const sections = home.payload.sections as Array<Record<string, unknown>>;
      // The opening picture applies to both presets: the location business's text-only starter hero becomes a picture hero.
      const heroAsset = Object.values(snapshot.media).find((m) => m.title === proof.photos.find((p) => p.file === proof.settings.hero_image)!.title)!;
      expect(sections[0]).toMatchObject({ type: "image_hero", imageAssetId: heroAsset.id, subheading: proof.settings.home_subheading });
      expect(snapshot.config.branding.logoAssetId).toBeTruthy();
      expect(snapshot.config.branding.typography).toBe(proof.settings.typography);

      const detailPath = proof.preset === "community_guide" ? "/places/kettle-coffee-cart" : "/locations/palisade";
      const indexPath = proof.preset === "community_guide" ? "/places" : "/locations";
      for (const theme of themesForPreset(proof.preset)) {
        const homeHtml = render(snapshot, key, "/", theme.key);
        expect(homeHtml, theme.key).toContain(`${theme.key}-theme`);
        expect(homeHtml, theme.key).toContain(html(proof.name));
        expect(homeHtml, theme.key).toContain(html(proof.settings.home_subheading ?? ""));
        expect(homeHtml, theme.key).not.toMatch(/(selected|added|published) yet\./);
        expect(homeHtml, theme.key).not.toContain("<script");
        // The starter home lists the latest places (six of them) or every store.
        const listed = (proof.rows.place ?? proof.rows.store ?? []).filter((row) => homeHtml.includes(html(row.title ?? ""))).length;
        expect(listed, `${theme.key} lists the directory on the home page`).toBeGreaterThanOrEqual(3);
        const detailHtml = render(snapshot, key, detailPath, theme.key);
        expect(detailHtml, theme.key).toContain(proof.preset === "community_guide" ? "Kettle Coffee Cart" : "Palisade Market");
        expect(detailHtml, theme.key).toMatch(/06:30|6:30|08:00|8:00|8 AM|6:30 AM/);
        const indexHtml = render(snapshot, key, indexPath, theme.key);
        expect(indexHtml, theme.key).not.toMatch(/published in [a-z]+ yet\./);
        for (const row of (proof.rows.place ?? proof.rows.store ?? [])) expect(indexHtml, `${theme.key} index lists ${row.title}`).toContain(html(row.title ?? ""));
      }
    });
  }
});

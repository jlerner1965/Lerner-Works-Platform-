import { afterAll, describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { renderToStaticMarkup } from "react-dom/server";
import { seedInfo, withUser, endPool, approveAll, publish, demoSnapshot } from "./helpers";
import { loadSiteContext } from "@/server/data/access";
import { createSiteFromPreset } from "@/server/data/sites";
import { createContentItem, getItem, saveRevision } from "@/server/data/content";
import { ingestDocument, ingestUpload, MAX_DOCUMENT_BYTES } from "@/server/media/ingest";
import { getStorage } from "@/server/media/storage";
import { buildCandidate } from "@/server/publishing/candidates";
import { exportSitePackage, dryRunPackage, applyPackage } from "@/server/import/package";
import { dryRunOnboarding, applyOnboarding } from "@/server/import/onboarding";
import { parseCsv, autoMap, dryRun } from "@/server/import/csv";
import { getTheme } from "@/themes";
import { resolveRoute } from "@/server/publishing/public-site";
import { makeRenderContext } from "@/server/publishing/render";
import type { ReleaseSnapshot } from "@/server/publishing/snapshot";
import { renderSimplePdf } from "@/server/demo/documents";

/**
 * Site-building programme B5-1 (SB-10): documents in the media library. A PDF is uploaded like a
 * picture, linked from text and buttons, listed as downloads on an article and on a page, frozen
 * into the release and served from the public content-hash store; the rights rules apply; the
 * site package and the onboarding package carry documents.
 */
const { users, organizations } = seedInfo();
const owner = users.owner;

afterAll(async () => {
  await endPool();
});

const pngHeader = () => {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
};
const csv = (rows: string[][]) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n") + "\r\n";
const clock = new Date("2026-09-27T12:00:00Z");

function render(snapshot: ReleaseSnapshot, siteKey: string, path: string): string {
  const basePath = `/demo/${siteKey}`;
  const ctx = makeRenderContext({ snapshot, basePath, mode: "demo", path, query: {}, inquiryEndpoint: `${basePath}/inquiries`, releaseVersion: 1, publishedAt: clock, now: clock });
  return renderToStaticMarkup(getTheme(snapshot).render(ctx, resolveRoute(snapshot, path)));
}

async function freshGuide(prefix: string): Promise<{ siteId: string; siteKey: string }> {
  const siteKey = `${prefix}-${Date.now().toString(36)}`;
  const { siteId } = await createSiteFromPreset(owner, { organizationId: organizations.pineHollow, key: siteKey, name: "Document tests", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: {} });
  return { siteId, siteKey };
}

describe("document ingestion (B5-1)", () => {
  it("accepts a PDF by signature into a private original with one file variant, and refuses everything else without storing anything", async () => {
    const { siteId } = await freshGuide("docs-ingest");
    const pdf = renderSimplePdf({ title: "Trail map", lines: ["Twelve miles of trail, marked at every junction."] });
    const truncated = pdf.subarray(0, pdf.byteLength - 20);
    const huge = new Uint8Array(MAX_DOCUMENT_BYTES + 1);
    huge.set(pdf.subarray(0, 8));
    const results = await withUser(owner, async (db) => {
      const site = (await loadSiteContext(db, siteId))!.site;
      const input = { siteId, organizationId: site.organizationId, userId: owner, declaredMime: "application/pdf", license: "Owned by the client" };
      return [
        await ingestDocument(db, { ...input, bytes: pngHeader(), filename: "picture.pdf" }),
        await ingestDocument(db, { ...input, bytes: pdf, filename: "map.png" }),
        await ingestDocument(db, { ...input, bytes: pdf, filename: "map.pdf", declaredMime: "image/png" }),
        await ingestDocument(db, { ...input, bytes: truncated, filename: "map.pdf" }),
        await ingestDocument(db, { ...input, bytes: huge, filename: "map.pdf" }),
        await ingestUpload(db, { ...input, bytes: pdf, filename: "Trail map.pdf", title: "Trail map" }),
        await ingestUpload(db, { ...input, bytes: pngHeader(), filename: "corrupt.png", declaredMime: "image/png" }),
      ];
    });
    expect(results.map((r) => (r.ok ? "ok" : r.code))).toEqual(["unsupported_type", "mismatch", "mismatch", "corrupt", "too_large", "ok", "corrupt"]);
    const accepted = results[5]!;
    const asset = accepted.ok ? accepted.asset : null;
    expect(asset).not.toBeNull();
    expect(asset!.kind).toBe("document");
    expect(asset!.width).toBeNull();
    expect(asset!.mimeType).toBe("application/pdf");
    expect(asset!.title).toBe("Trail map");
    expect(asset!.altText).toBeNull();
    expect(Object.keys(asset!.derivatives)).toEqual(["file"]);
    expect(asset!.derivatives.file!.path).toBe(`${asset!.sha256}.pdf`);
    expect(asset!.derivatives.file!.bytes).toBe(pdf.byteLength);
    const storage = getStorage();
    const stored = await storage.getPrivate(asset!.derivatives.file!.key);
    expect(stored).not.toBeNull();
    expect(Buffer.from(stored!).equals(Buffer.from(pdf))).toBe(true);
    expect(await storage.existsPublic(asset!.derivatives.file!.path)).toBe(false);
    const count = await withUser(owner, (db) => db<{ n: number }[]>`select count(*)::int as n from public.media_assets where site_id = ${siteId}`);
    expect(count[0]!.n).toBe(1);
    // A document cannot be given a picture's dimensions, and a picture cannot lose its own.
    await expect(withUser(owner, (db) => db`update public.media_assets set kind = 'image' where id = ${asset!.id}`)).rejects.toBeDefined();
  });
});

describe("documents through publication, the package and the onboarding import (SB-10)", () => {
  it("links, attaches and lists a document, freezes it into the release, serves it publicly, applies the rights rules and round-trips it through the site package", async () => {
    const { siteId, siteKey } = await freshGuide("docs-pub");
    const pdf = renderSimplePdf({ title: "Trail map", lines: ["Twelve miles of trail, marked at every junction.", "Start at the Larkspur Loop lot."] });
    const site = (await withUser(owner, (db) => loadSiteContext(db, siteId)))!.site;
    const doc = await withUser(owner, async (db) => {
      const r = await ingestDocument(db, { siteId, organizationId: site.organizationId, userId: owner, bytes: pdf, filename: "trail-map.pdf", declaredMime: "application/pdf", title: "Trail map", license: "Owned by the client" });
      if (!r.ok) throw new Error(r.error);
      return r.asset;
    });
    const article = await withUser(owner, (db) => createContentItem(db, {
      siteId, organizationId: site.organizationId, kind: "article", authorId: owner,
      payload: {
        title: "Trail day recap", slug: "trail-day-recap", summary: "Forty volunteers, three miles of trail, one long lunch at the trailhead.", authorName: "Maya Ortiz", publishedOn: "2026-09-01",
        body: [{ type: "paragraph", text: `Read [the map](document:${doc.id}) before you go.` }, { type: "button", label: "Download the map", target: `document:${doc.id}` }],
        attachments: [{ assetId: doc.id, label: "Trail map (PDF)" }],
      },
    }));
    const page = await withUser(owner, (db) => createContentItem(db, {
      siteId, organizationId: site.organizationId, kind: "page", authorId: owner,
      payload: {
        title: "Downloads", slug: "downloads", summary: "Maps and forms to take with you on the trail.",
        sections: [
          { id: "h", type: "text_hero", heading: "Downloads", subheading: "Maps and forms." },
          { id: "d", type: "downloads", heading: "Maps", intro: "Print them or keep them on your phone.", items: [{ assetId: doc.id, label: "", note: "Issued spring 2026" }] },
        ],
      },
    }));
    await approveAll(owner, siteId);
    await publish(owner, siteId, "documents");
    const released = (await demoSnapshot(siteKey))!;
    const snapshot = released.snapshot as unknown as ReleaseSnapshot;
    expect(snapshot.schemaVersion).toBe(6);
    const media = snapshot.media[doc.id]!;
    expect(media).toMatchObject({ kind: "document", mime: "application/pdf", title: "Trail map", width: 0 });
    expect(media.variants.file!.path).toBe(`${doc.sha256}.pdf`);
    expect(Object.keys(media.variants)).toEqual(["file"]);
    const storage = getStorage();
    expect(await storage.existsPublic(media.variants.file!.path)).toBe(true);
    const publicBytes = await storage.getPublic(media.variants.file!.path);
    expect(Buffer.from(publicBytes!).equals(Buffer.from(pdf))).toBe(true);

    // The article: the inline link and the button open the published copy; the attachment is listed with its type and size.
    const articleHtml = render(snapshot, siteKey, "/articles/trail-day-recap");
    expect(articleHtml).toContain(`href="/assets/${doc.sha256}.pdf"`);
    expect(articleHtml).toContain(">the map</span></a>");
    expect(articleHtml).toContain(">Download the map</a>");
    expect(articleHtml).toContain("Trail map (PDF)");
    expect(articleHtml).toContain('download="Trail-map-PDF.pdf"');
    expect(articleHtml).toMatch(/PDF · \d+ KB/);
    // The page: the downloads section names the document by its title when the label is empty.
    const pageHtml = render(snapshot, siteKey, "/downloads");
    expect(pageHtml).toContain(">Trail map</a>");
    expect(pageHtml).toContain("Issued spring 2026");
    expect(pageHtml).toContain(`href="/assets/${doc.sha256}.pdf"`);

    // A document where a picture belongs blocks publication; so does a document without a recorded license.
    const current = (await withUser(owner, (db) => getItem(db, article.item.id)))!;
    await withUser(owner, (db) => saveRevision(db, { itemId: article.item.id, baseRevisionId: current.revision.id, payload: { ...current.revision.payload, featuredImageAssetId: doc.id }, authorId: owner }));
    await approveAll(owner, siteId);
    const mismatch = await buildCandidate(owner, site);
    expect(mismatch.candidate.state).toBe("blocked");
    expect(mismatch.candidate.validation.blockers.find((b) => b.code === "media_kind_mismatch")?.message).toContain("needs a picture");
    const unlicensed = await withUser(owner, async (db) => {
      const r = await ingestDocument(db, { siteId, organizationId: site.organizationId, userId: owner, bytes: renderSimplePdf({ title: "Price list", lines: ["Coffee 3.50"] }), filename: "prices.pdf", declaredMime: "", title: "Price list" });
      if (!r.ok) throw new Error(r.error);
      return r.asset;
    });
    const afterMismatch = (await withUser(owner, (db) => getItem(db, article.item.id)))!;
    await withUser(owner, (db) => saveRevision(db, { itemId: article.item.id, baseRevisionId: afterMismatch.revision.id, payload: { ...afterMismatch.revision.payload, featuredImageAssetId: null, attachments: [{ assetId: doc.id, label: "Trail map (PDF)" }, { assetId: unlicensed.id, label: "" }] }, authorId: owner }));
    await approveAll(owner, siteId);
    const blocked = await buildCandidate(owner, site);
    expect(blocked.candidate.state).toBe("blocked");
    expect(blocked.candidate.validation.blockers.map((b) => b.code)).toEqual(["unlicensed_asset"]);
    expect(blocked.candidate.validation.blockers[0]!.message).toContain('Document "Price list"');
    expect(blocked.candidate.validation.blockers.map((b) => b.code)).not.toContain("missing_alt");
    const afterBlocked = (await withUser(owner, (db) => getItem(db, article.item.id)))!;
    await withUser(owner, (db) => saveRevision(db, { itemId: article.item.id, baseRevisionId: afterBlocked.revision.id, payload: { ...afterBlocked.revision.payload, attachments: [{ assetId: doc.id, label: "Trail map (PDF)" }] }, authorId: owner }));
    await approveAll(owner, siteId);
    expect((await buildCandidate(owner, site)).candidate.state).toBe("ready");

    // The site package carries the document as uploaded and the import re-creates it, rewriting every reference to it.
    const zip = await withUser(owner, (db) => exportSitePackage(db, site));
    const entries = unzipSync(zip);
    const docFile = `media/${doc.id}/document.pdf`;
    expect(entries[docFile]).toBeDefined();
    expect(Buffer.from(entries[docFile]!).equals(Buffer.from(pdf))).toBe(true);
    const meta = JSON.parse(strFromU8(entries[`media/${doc.id}/meta.json`]!)) as { kind: string; mime: string; width: number; license: string };
    expect(meta).toMatchObject({ kind: "document", mime: "application/pdf", width: 0, license: "Owned by the client" });
    expect(strFromU8(entries["README.md"]!)).toContain("document.pdf");
    const { siteId: copyId } = await freshGuide("docs-copy");
    const applied = await withUser(owner, async (db) => {
      const copy = (await loadSiteContext(db, copyId))!.site;
      const dry = await dryRunPackage(db, copy, zip);
      expect(dry.errors).toEqual([]);
      expect(dry.media.map((m) => m.kind ?? "image").sort()).toEqual(["document", "document"]);
      return applyPackage(db, copy, owner, dry, { approve: true });
    });
    expect(applied.media).toBe(2);
    const copied = await withUser(owner, (db) => db<{ payload: Record<string, unknown> }[]>`select r.payload from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${copyId} and r.slug = 'trail-day-recap'`);
    const attachments = copied[0]!.payload.attachments as Array<{ assetId: string }>;
    expect(attachments).toHaveLength(1);
    expect(attachments[0]!.assetId).not.toBe(doc.id);
    const copiedDoc = await withUser(owner, (db) => db<{ siteId: string; kind: string; sha256: string }[]>`select site_id, kind::text, sha256 from public.media_assets where id = ${attachments[0]!.assetId}`);
    expect(copiedDoc[0]).toMatchObject({ siteId: copyId, kind: "document", sha256: doc.sha256 });
    const body = copied[0]!.payload.body as Array<{ type: string; text?: string; target?: string }>;
    expect(body[0]!.text).toContain(`document:${attachments[0]!.assetId}`);
    expect(body[1]!.target).toBe(`document:${attachments[0]!.assetId}`);
    const copiedPage = await withUser(owner, (db) => db<{ payload: { sections: Array<{ type: string; items?: Array<{ assetId: string }> }> } }[]>`select r.payload from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${copyId} and r.slug = 'downloads'`);
    expect(copiedPage[0]!.payload.sections.find((s) => s.type === "downloads")?.items?.[0]?.assetId).toBe(attachments[0]!.assetId);
    void page;

    // Withdrawing the document blocks the next release and names it as a document.
    await withUser(owner, (db) => db`select public.withdraw_media_asset(${doc.id}, 'superseded map for the test')`);
    const withdrawn = await buildCandidate(owner, site);
    expect(withdrawn.candidate.state).toBe("blocked");
    expect(withdrawn.candidate.validation.blockers.find((b) => b.code === "missing_media")?.message).toBe("A referenced document was withdrawn.");
  });

  it("brings documents in through the onboarding package's documents folder and the rows' attachments column", async () => {
    const { siteId } = await freshGuide("docs-onb");
    const guide = renderSimplePdf({ title: "Visitor guide", lines: ["Where to park, where to eat, where to walk."] });
    const menu = renderSimplePdf({ title: "Autumn menu", lines: ["Soup of the day 6.00"] });
    const files: Record<string, Uint8Array> = {
      "articles.csv": strToU8(csv([
        ["external_id", "title", "author_name", "published_on", "summary", "body", "attachments"],
        ["A-1", "Plan your visit", "Cedar Bend Guide", "2026-09-01", "Everything to print before you come: the guide and the market menu.", "Two documents to take along.", "guide.pdf;menu.pdf"],
        ["A-2", "A row naming a missing document", "Cedar Bend Guide", "2026-09-02", "This row is listed with its error and skipped.", "", "missing.pdf"],
      ])),
      "documents.csv": strToU8(csv([
        ["file", "title", "license", "attribution", "source_url"],
        ["guide.pdf", "Visitor guide 2026", "Owned by the client", "", ""],
        ["menu.pdf", "", "", "", ""],
        ["ghost.pdf", "Listed but not in the folder", "", "", ""],
      ])),
      "documents/guide.pdf": guide,
      "documents/menu.pdf": menu,
      "documents/notes.pdf": pngHeader(),
    };
    const site = (await withUser(owner, (db) => loadSiteContext(db, siteId)))!.site;
    const first = await withUser(owner, (db) => dryRunOnboarding(db, site, zipSync(files), { canApplySettings: true }));
    expect(first.errors).toEqual(["documents/notes.pdf is not a PDF file."]);
    delete files["documents/notes.pdf"];
    const dry = await withUser(owner, (db) => dryRunOnboarding(db, site, zipSync(files), { canApplySettings: true }));
    expect(dry.errors).toEqual([]);
    expect(dry.summary).toMatchObject({ items: 1, images: 0, documents: 2, rowErrors: 1 });
    expect(dry.documents.map((d) => [d.file, d.title, d.license])).toEqual([["guide.pdf", "Visitor guide 2026", "Owned by the client"], ["menu.pdf", "menu", ""]]);
    expect(dry.warnings).toEqual(expect.arrayContaining([expect.stringContaining('"ghost.pdf", which is not in the documents folder'), expect.stringContaining("documents/menu.pdf has no license")]));
    const rows = dry.kinds[0]!.rows;
    expect(rows.find((r) => r.externalId === "A-1")).toMatchObject({ action: "create", attachments: ["guide.pdf", "menu.pdf"] });
    expect(rows.find((r) => r.externalId === "A-2")?.errors).toEqual(['attachments: no file named "missing.pdf" in the package\'s documents folder']);
    const applied = await withUser(owner, (db) => applyOnboarding(db, site, owner, dry, { approve: true, applySettings: true }));
    expect(applied).toMatchObject({ created: 1, documents: 2, images: 0 });
    const item = await withUser(owner, (db) => db<{ payload: { attachments: Array<{ assetId: string; label: string }> } }[]>`select r.payload from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${siteId} and i.external_id = 'A-1'`);
    const ids = item[0]!.payload.attachments.map((a) => a.assetId);
    expect(ids).toHaveLength(2);
    const assets = await withUser(owner, (db) => db<{ id: string; kind: string; title: string; license: string | null }[]>`select id, kind::text, title, license from public.media_assets where id = any(${ids}) order by title`);
    expect(assets.map((a) => [a.kind, a.title, a.license])).toEqual([["document", "Visitor guide 2026", "Owned by the client"], ["document", "menu", null]]);
    // Outside a package, the attachments column must stay empty.
    const plain = parseCsv(csv([["external_id", "title", "author_name", "published_on", "attachments"], ["A-9", "Loose row", "Someone", "2026-09-03", "guide.pdf"]]));
    const loose = await withUser(owner, (db) => dryRun(db, site, "article", plain, autoMap("article", plain.headers)));
    expect(loose.rows[0]!.errors).toEqual(["attachments: documents come with the onboarding package; leave the column empty in a CSV import"]);
  });
});

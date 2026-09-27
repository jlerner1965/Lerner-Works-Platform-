import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sniffDocumentType, sniffUploadKind } from "@/server/media/ingest";
import { PUBLIC_ASSET_NAME, publicAssetContentType, publicAssetHeaders, isDocumentLink, documentLinkId, formatBytes } from "@/server/media/content-types";
import { collectAssetRefs, toSnapshotMedia, type MediaAssetRow } from "@/server/publishing/manifest";
import { validateManifest } from "@/server/publishing/validate";
import { SNAPSHOT_SCHEMA_VERSION, SUPPORTED_SNAPSHOT_SCHEMA_VERSIONS, isSnapshotDocument, normalizeSnapshot, type ReleaseSnapshot, type SnapshotMedia } from "@/server/publishing/snapshot";
import { makeRenderContext } from "@/server/publishing/render";
import { sectionSchema, emptySection, linkTargetPattern, sectionVariants } from "@/modules/page";
import { articlePayloadSchema } from "@/modules/article";
import { presets } from "@/modules/presets";
import { siteConfigSchema } from "@/modules/site-config";
import { sectionHasContent } from "@/themes/shared/empty";
import { DownloadsSection, Attachments, documentHref, downloadFileName } from "@/themes/shared/documents";
import { resolveLinkTarget } from "@/themes/shared/richtext";
import { linkProps } from "@/themes/shared/site-root";
import { guideStyle } from "@/themes/guide/index";
import { themeCapabilities } from "@/themes/capabilities";
import { columnsFor } from "@/themes/shared/design";
import { renderSimplePdf } from "@/server/demo/documents";

/**
 * Site-building programme B5-1: documents in the media library. The signature check, the
 * public names, the references a release collects, the publication rules, and the rendering
 * of downloads, all without a database.
 */
const D = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const D2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const IMG = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const HASH = "0".repeat(63) + "1";

describe("document signatures and public names", () => {
  it("recognises a PDF by its signature and nothing else by its name", () => {
    const pdf = renderSimplePdf({ title: "Trail map", lines: ["Twelve miles of trail, marked."] });
    expect(sniffDocumentType(pdf)).toBe("application/pdf");
    expect(sniffUploadKind(pdf)).toBe("document");
    expect(sniffDocumentType(new Uint8Array([0xef, 0xbb, 0xbf, 0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]))).toBe("application/pdf");
    expect(sniffDocumentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBeNull();
    expect(sniffUploadKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe("image");
    expect(sniffUploadKind(new TextEncoder().encode("<!doctype html><html></html>"))).toBeNull();
    // The sample PDF ends with the end-of-file marker every reader expects.
    expect(new TextDecoder().decode(pdf.subarray(pdf.byteLength - 8))).toContain("%%EOF");
  });

  it("serves only content-hash names, each with its own type; documents open inline under a stable name", () => {
    expect(PUBLIC_ASSET_NAME.test(`${HASH}-w480.webp`)).toBe(true);
    expect(PUBLIC_ASSET_NAME.test(`${HASH}.pdf`)).toBe(true);
    expect(PUBLIC_ASSET_NAME.test(`${HASH}.exe`)).toBe(false);
    expect(PUBLIC_ASSET_NAME.test(`../${HASH}.pdf`)).toBe(false);
    expect(PUBLIC_ASSET_NAME.test(`${HASH}-w481.webp`)).toBe(false);
    expect(publicAssetContentType(`${HASH}-w960.webp`)).toBe("image/webp");
    expect(publicAssetContentType(`${HASH}.pdf`)).toBe("application/pdf");
    expect(publicAssetContentType("index.html")).toBeNull();
    const headers = publicAssetHeaders(`${HASH}.pdf`, 1234)!;
    expect(headers["Content-Type"]).toBe("application/pdf");
    expect(headers["Content-Disposition"]).toMatch(/^inline; filename="[0-9a-f]{12}\.pdf"$/);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Cache-Control"]).toContain("immutable");
    expect(publicAssetHeaders(`${HASH}-w480.webp`, 1)!["Content-Disposition"]).toBeUndefined();
    expect(publicAssetHeaders("evil.pdf", 1)).toBeNull();
    expect(isDocumentLink(`document:${D}`)).toBe(true);
    expect(isDocumentLink(`document:${D.toUpperCase()}`)).toBe(true);
    expect(isDocumentLink("document:nope")).toBe(false);
    expect(documentLinkId(`document:${D.toUpperCase()}`)).toBe(D);
    expect(formatBytes(900)).toBe("1 KB");
    expect(formatBytes(340 * 1024)).toBe("340 KB");
    expect(formatBytes(1.25 * 1024 * 1024)).toBe("1.3 MB");
    expect(formatBytes(12 * 1024 * 1024)).toBe("12 MB");
  });
});

describe("the vocabulary gained documents", () => {
  it("adds the downloads section to every theme and accepts document links where a button may point anywhere", () => {
    expect(sectionVariants.downloads).toEqual(["default", "list", "grid"]);
    for (const caps of Object.values(themeCapabilities)) {
      expect(caps.sectionTypes, caps.key).toContain("downloads");
      expect(columnsFor(caps.key, "downloads", undefined)).toBeGreaterThanOrEqual(2);
    }
    const section = emptySection("downloads", "d");
    expect(section).toMatchObject({ type: "downloads", heading: "Downloads", items: [], variant: "default" });
    expect(sectionSchema.safeParse({ type: "downloads", id: "d", items: [{ assetId: D, label: "Map", note: "Issued 2026" }] }).success).toBe(true);
    expect(sectionSchema.safeParse({ type: "downloads", id: "d", items: [{ assetId: "not-an-id" }] }).success).toBe(false);
    expect(linkTargetPattern.test(`document:${D}`)).toBe(true);
    expect(linkTargetPattern.test("document:x")).toBe(false);
    expect(sectionSchema.safeParse({ type: "cta_banner", id: "c", heading: "Read it", ctaLabel: "Download", ctaPath: `document:${D}` }).success).toBe(true);
    expect(sectionSchema.safeParse({ type: "team", id: "t", items: [{ name: "Ada", path: `document:${D}` }] }).success).toBe(true);
    // A hero's call to action stays a site path.
    expect(sectionSchema.safeParse({ type: "text_hero", id: "h", heading: "Hi", ctaLabel: "Go", ctaPath: `document:${D}` }).success).toBe(false);
  });

  it("gives every item an attachments list that defaults to empty, so older payloads keep parsing", () => {
    const article = articlePayloadSchema.parse({ title: "Report", slug: "report", authorName: "Ada", publishedOn: "2026-09-01" });
    expect(article.attachments).toEqual([]);
    expect(articlePayloadSchema.safeParse({ ...article, attachments: [{ assetId: D, label: "The report" }] }).success).toBe(true);
    expect(articlePayloadSchema.safeParse({ ...article, attachments: [{ assetId: "x" }] }).success).toBe(false);
    expect(SNAPSHOT_SCHEMA_VERSION).toBe(6);
    expect(SUPPORTED_SNAPSHOT_SCHEMA_VERSIONS).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("references a release collects", () => {
  it("names the kind each field expects: pictures for image slots, documents for links, attachments and downloads", () => {
    const refs = collectAssetRefs("article", {
      featuredImageAssetId: IMG,
      body: [
        { type: "paragraph", text: `Read [the report](document:${D}).` },
        { type: "image", assetId: IMG },
        { type: "button", label: "Map", target: `document:${D2}` },
      ],
      attachments: [{ assetId: D, label: "" }],
    });
    expect(refs).toEqual([
      { assetId: IMG, field: "featuredImageAssetId", kind: "image" },
      { assetId: IMG, field: "body", kind: "image" },
      { assetId: D, field: "body", kind: "document" },
      { assetId: D2, field: "body", kind: "document" },
      { assetId: D, field: "attachments.0.assetId", kind: "document" },
    ]);
    const page = collectAssetRefs("page", {
      sections: [
        { type: "downloads", items: [{ assetId: D }, { assetId: D2 }] },
        { type: "cta_banner", ctaPath: `document:${D}`, secondaryPath: "/contact" },
        { type: "team", items: [{ assetId: IMG, path: `document:${D2}` }] },
        { type: "image_text", items: [{ assetId: IMG, ctaPath: `document:${D}`, body: [{ type: "paragraph", text: `[x](document:${D2})` }] }] },
      ],
    });
    expect(page).toEqual([
      { assetId: D, field: "sections.0.items.0.assetId", kind: "document" },
      { assetId: D2, field: "sections.0.items.1.assetId", kind: "document" },
      { assetId: D, field: "sections.1.ctaPath", kind: "document" },
      { assetId: IMG, field: "sections.2.items.0.assetId", kind: "image" },
      { assetId: D2, field: "sections.2.items.0.path", kind: "document" },
      { assetId: IMG, field: "sections.3.items.0.assetId", kind: "image" },
      { assetId: D2, field: "sections.3.items.0.body", kind: "document" },
      { assetId: D, field: "sections.3.items.0.ctaPath", kind: "document" },
    ]);
  });

  it("freezes a document with its file variant and says what it is; pictures keep their earlier shape", () => {
    const row: MediaAssetRow = {
      id: D, siteId: "s", organizationId: "o", kind: "document", status: "ready", originalKey: "o/s/d/original.pdf", mimeType: "application/pdf", sha256: HASH,
      width: null, height: null, byteSize: 3456, title: "Trail map", altText: null, decorative: false, attributionText: null, license: "Owned by the client",
      derivatives: { file: { key: "o/s/d/original.pdf", path: `${HASH}.pdf`, width: 0, height: 0, bytes: 3456, hash: HASH } },
    };
    const media = toSnapshotMedia(row);
    expect(media).toMatchObject({ id: D, kind: "document", mime: "application/pdf", width: 0, height: 0, alt: "", title: "Trail map" });
    expect(media.variants.file?.path).toBe(`${HASH}.pdf`);
    expect(isSnapshotDocument(media)).toBe(true);
    const picture = toSnapshotMedia({ ...row, id: IMG, kind: "image", width: 1600, height: 1200, mimeType: "image/jpeg", derivatives: { w480: { key: "k", path: `${HASH}-w480.webp`, width: 480, height: 360, bytes: 1, hash: HASH } } });
    expect("kind" in picture).toBe(false);
    expect("mime" in picture).toBe(false);
    expect(isSnapshotDocument(picture)).toBe(false);
  });
});

const config = siteConfigSchema.parse(presets.community_guide.config({ siteName: "Test Guide" }));

function document(overrides: Partial<SnapshotMedia> = {}): SnapshotMedia {
  return { id: D, hash: HASH, width: 0, height: 0, alt: "", decorative: false, title: "Trail map", attribution: "", license: "Owned by the client", variants: { file: { key: "k", path: `${HASH}.pdf`, width: 0, height: 0, bytes: 12 * 1024, hash: HASH } }, kind: "document", mime: "application/pdf", ...overrides };
}

function snapshot(sections: Array<Record<string, unknown>>, media: Record<string, SnapshotMedia>, articleBody: Array<Record<string, unknown>> = []): ReleaseSnapshot {
  const pages = presets.community_guide.initialPages({ siteName: "Test Guide" });
  const home = { ...(pages[0]!.payload as unknown as Record<string, unknown>), sections: [...((pages[0]!.payload as unknown as { sections: unknown[] }).sections), ...sections] };
  const article = articlePayloadSchema.parse({ title: "Trail day recap", slug: "trail-day-recap", summary: "Forty volunteers, three miles of trail, one long lunch.", authorName: "Maya Ortiz", publishedOn: "2026-09-01", body: articleBody, attachments: media[D] ? [{ assetId: D, label: "" }] : [] });
  return {
    schemaVersion: 6,
    site: { id: "11111111-1111-4111-8111-111111111111", key: "test", name: "Test Guide", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: { email: "", phone: "", address: "" } },
    configRevisionId: "22222222-2222-4222-8222-222222222222",
    config,
    items: {
      home: { id: "home", kind: "page", slug: "home", title: "Home", revisionId: "r1", revisionVersion: 1, payload: home },
      about: { id: "about", kind: "page", slug: "about", title: "About", revisionId: "r2", revisionVersion: 1, payload: pages[1]!.payload as unknown as Record<string, unknown> },
      contact: { id: "contact", kind: "page", slug: "contact", title: "Contact", revisionId: "r3", revisionVersion: 1, payload: pages[2]!.payload as unknown as Record<string, unknown> },
      a1: { id: "a1", kind: "article", slug: "trail-day-recap", title: "Trail day recap", revisionId: "r4", revisionVersion: 1, payload: article as unknown as Record<string, unknown> },
    },
    routes: [
      { path: "/", kind: "page", itemId: "home" },
      { path: "/about", kind: "page", itemId: "about" },
      { path: "/contact", kind: "page", itemId: "contact" },
      { path: "/places", kind: "index", module: "places" },
      { path: "/events", kind: "index", module: "events" },
      { path: "/articles", kind: "index", module: "articles" },
      { path: "/search", kind: "search" },
      { path: "/articles/trail-day-recap", kind: "article", itemId: "a1" },
    ],
    redirects: [],
    media,
  };
}

describe("publication rules for documents", () => {
  const now = new Date("2026-09-27T00:00:00Z");
  const downloads = { id: "dl", type: "downloads", variant: "default", appearance: { background: "default", align: "start", width: "default" }, heading: "Downloads", intro: "", items: [{ assetId: D, label: "The map", note: "" }] };

  it("needs a license but no alternative text for a document, and lets text link to it", () => {
    const manifest = snapshot([downloads], { [D]: document() }, [{ type: "paragraph", text: `Read [the map](document:${D}).` }]);
    const result = validateManifest({ manifest, notes: [], mediaRows: new Map(), missingMedia: [] }, { now });
    expect(result.blockers.map((b) => b.code)).not.toContain("missing_alt");
    expect(result.blockers.map((b) => b.code)).not.toContain("unsafe_link");
    expect(result.blockers.map((b) => b.code)).not.toContain("broken_link");
    const unlicensed = validateManifest({ manifest: snapshot([downloads], { [D]: document({ license: "" }) }), notes: [], mediaRows: new Map(), missingMedia: [] }, { now });
    const finding = unlicensed.blockers.find((b) => b.code === "unlicensed_asset");
    expect(finding?.message).toContain('Document "Trail map"');
    expect(unlicensed.blockers.map((b) => b.code)).not.toContain("missing_alt");
    expect(unlicensed.warnings.map((w) => w.code)).not.toContain("large_image");
  });

  it("blocks a missing document, an empty download slot and a picture where a document belongs", () => {
    const manifest = snapshot([downloads, { ...downloads, id: "dl2", items: [{ assetId: "", label: "", note: "" }] }], {});
    const result = validateManifest({ manifest, notes: [], mediaRows: new Map(), missingMedia: [{ assetId: D, itemId: "home", field: "sections.5.items.0.assetId" }], mediaKindMismatches: [{ assetId: IMG, itemId: "a1", field: "attachments.0.assetId", expected: "document", actual: "image" }] }, { now });
    const codes = result.blockers.map((b) => b.code);
    expect(codes).toContain("missing_media");
    expect(result.blockers.find((b) => b.code === "missing_media")?.message).toContain("image or document");
    expect(result.blockers.filter((b) => b.code === "empty_section").some((b) => b.message.includes("document 1 has no file chosen"))).toBe(true);
    expect(result.blockers.find((b) => b.code === "media_kind_mismatch")?.message).toContain("needs a document");
    // A withdrawn document is named as such.
    const row = { id: D, kind: "document", status: "withdrawn", title: "Trail map" } as unknown as MediaAssetRow;
    const withdrawn = validateManifest({ manifest, notes: [], mediaRows: new Map([[D, row]]), missingMedia: [{ assetId: D, itemId: "home", field: "sections.5.items.0.assetId" }] }, { now });
    expect(withdrawn.blockers.find((b) => b.code === "missing_media")?.message).toBe("A referenced document was withdrawn.");
  });

  it("leaves a downloads section out while none of its documents are in the release", () => {
    const withDoc = snapshot([], { [D]: document() });
    const scope = { snapshot: withDoc, now };
    const parsed = sectionSchema.parse(downloads);
    expect(sectionHasContent(scope, parsed)).toBe(true);
    expect(sectionHasContent({ snapshot: snapshot([], {}), now }, parsed)).toBe(false);
  });
});

describe("documents on the public page", () => {
  const clock = new Date("2026-09-27T12:00:00Z");
  const ctxFor = (s: ReleaseSnapshot, path: string) => makeRenderContext({ snapshot: s, basePath: "/demo/test", mode: "demo", path, query: {}, inquiryEndpoint: null, releaseVersion: 1, publishedAt: clock, now: clock });

  it("resolves document links to the published copy and gives the download its own file name", () => {
    const s = snapshot([], { [D]: document() });
    const ctx = ctxFor(s, "/");
    expect(documentHref(ctx, D)).toBe(`/assets/${HASH}.pdf`);
    expect(documentHref(ctx, D2)).toBeNull();
    expect(resolveLinkTarget(ctx, `document:${D}`)).toBe(`/assets/${HASH}.pdf`);
    expect(resolveLinkTarget(ctx, `document:${D2}`)).toBeNull();
    expect(linkProps(ctx, `document:${D}`)).toEqual({ href: `/assets/${HASH}.pdf`, type: "application/pdf" });
    expect(linkProps(ctx, `document:${D2}`)).toEqual({ href: "/demo/test" });
    expect(downloadFileName(document(), "")).toBe("Trail-map.pdf");
    expect(downloadFileName(document(), "Autumn menu (2026)")).toBe("Autumn-menu-2026.pdf");
    expect(normalizeSnapshot(s)?.schemaVersion).toBe(6);
  });

  it("renders the downloads section and an item's attachments with type, size and a download link, and nothing when there are none", () => {
    const s = snapshot([], { [D]: document() });
    const ctx = ctxFor(s, "/");
    const section = sectionSchema.parse({ id: "dl", type: "downloads", heading: "Downloads", intro: "Take these with you.", items: [{ assetId: D, label: "The map", note: "Issued spring 2026" }, { assetId: D2, label: "Missing" }] });
    if (section.type !== "downloads") throw new Error("wrong type");
    const html = renderToStaticMarkup(createElement(DownloadsSection, { ctx, section, style: guideStyle }));
    expect(html).toContain(`href="/assets/${HASH}.pdf"`);
    expect(html).toContain('type="application/pdf"');
    expect(html).toContain(">The map</a>");
    expect(html).toContain("Issued spring 2026");
    expect(html).toContain("PDF · 12 KB");
    expect(html).toContain('download="The-map.pdf"');
    expect(html).not.toContain("Missing");
    expect(html).toContain("Take these with you.");
    const grid = renderToStaticMarkup(createElement(DownloadsSection, { ctx, section: { ...section, variant: "grid" }, style: guideStyle }));
    expect(grid).toContain("grid");
    const article = renderToStaticMarkup(createElement(Attachments, { ctx, item: s.items.a1!, style: guideStyle }));
    expect(article).toContain("Downloads");
    expect(article).toContain(">Trail map</a>");
    expect(article).toContain(`href="/assets/${HASH}.pdf"`);
    // No attachments, or attachments the release does not carry: nothing at all, so earlier releases render as recorded.
    const bare = snapshot([], {});
    expect(renderToStaticMarkup(createElement(Attachments, { ctx: ctxFor(bare, "/"), item: bare.items.a1!, style: guideStyle }))).toBe("");
    expect(renderToStaticMarkup(createElement(DownloadsSection, { ctx: ctxFor(bare, "/"), section, style: guideStyle }))).toBe("");
  });
});

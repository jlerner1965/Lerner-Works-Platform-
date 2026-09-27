import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { NextRequest } from "next/server";
import { inspectSiteArchive, isUploadedSnapshot, publicNameFor, resolveUploadedPath, toUploadedSnapshot, MAX_FILES, UPLOADED_SCHEMA_VERSION } from "@/server/uploaded/archive";
import { serveUploaded, uploadedFileHeaders } from "@/server/uploaded/serve";
import { stableJson } from "@/server/uploaded/publish";
import { sampleUploadedSiteFiles, sampleUploadedSiteZip } from "@/server/demo/uploaded-sample";
import { normalizeSnapshot } from "@/server/publishing/snapshot";
import { RESTORABLE_SCHEMA_VERSIONS } from "@/server/publishing/activate";
import { proxy } from "@/proxy";

/**
 * Uploaded sites (site-building programme B7): what a ZIP may hold and how it is read, how a
 * path finds its file, what a file is served with, and how the proxy sends a preview
 * hostname to the file handler. Pure functions; no database.
 */
const zip = (files: Record<string, string | Uint8Array>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, typeof v === "string" ? strToU8(v) : v])));

describe("inspecting a site archive", () => {
  it("reads the sample site clean: nine files, an index, a 404 page, sorted paths, content types and hashes", () => {
    const r = inspectSiteArchive(sampleUploadedSiteZip());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.files.map((f) => f.path)).toEqual(["/404.html", "/about.html", "/contact.html", "/css/site.css", "/images/mark.svg", "/index.html", "/robots.txt", "/thanks.html", "/work.html"]);
    expect(r.hasIndex).toBe(true);
    expect(r.hasNotFoundPage).toBe(true);
    expect(r.strippedFolder).toBeNull();
    expect(r.files.find((f) => f.path === "/css/site.css")!.type).toBe("text/css; charset=utf-8");
    expect(r.files.find((f) => f.path === "/images/mark.svg")!.type).toBe("image/svg+xml");
    expect(r.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256))).toBe(true);
    expect(r.totalBytes).toBe(Object.values(sampleUploadedSiteFiles()).reduce((n, t) => n + strToU8(t).byteLength, 0));
    expect(publicNameFor(r.files[0]!.sha256, r.files[0]!.path)).toBe(`${r.files[0]!.sha256}.html`);
  });

  it("drops a zipped folder's name, skips system droppings and hidden files, and warns about a form that posts elsewhere", () => {
    const r = inspectSiteArchive(zip({
      "my-site/index.html": "<html><body><form action='https://formspree.example/x'></form></body></html>",
      "my-site/css/a.css": "body{}",
      "my-site/.env": "SECRET=1",
      "my-site/.DS_Store": "x",
      "__MACOSX/my-site/._index.html": "x",
      "my-site/images/Thumbs.db": "x",
    }));
    expect(r.errors).toEqual([]);
    expect(r.strippedFolder).toBe("my-site");
    expect(r.files.map((f) => f.path)).toEqual(["/css/a.css", "/index.html"]);
    expect(r.warnings).toEqual([
      'Hidden file "/.env" skipped.',
      "No 404.html: visitors who mistype an address get a plain not-found page.",
      "A form in the site does not post to the platform's inquiry endpoint; see the contact form snippet on the site's overview.",
    ]);
  });

  it("refuses server-side files, unknown file types, unsafe names, a missing index and what is not a ZIP", () => {
    const r = inspectSiteArchive(zip({ "index.html": "<p>hi</p>", "api/send.php": "<?php", "tool.exe": "MZ", "notes.docx": "x", "odd name?.html": "x", "a/../b.html": "x" }));
    // Errors come in the order the files sit in the archive; an unsafe name is quoted as it was written.
    expect([...r.errors].sort()).toEqual([
      '"/api/send.php" is a server-side file; this hosts finished HTML, CSS, JavaScript and media only.',
      '"/notes.docx" is not a kind of file a website serves (.docx).',
      '"/odd name?.html" has characters a web address cannot carry; rename it to letters, digits, dots, dashes and underscores.',
      '"/tool.exe" is a server-side file; this hosts finished HTML, CSS, JavaScript and media only.',
      '"a/../b.html" cannot be served: a . or .. segment.',
    ]);
    expect(inspectSiteArchive(zip({ "about.html": "x", "css/a.css": "y" })).errors).toEqual(["No index.html at the top level of the ZIP: the site needs a home page there (a zipped folder is fine; its name is dropped)."]);
    expect(inspectSiteArchive(strToU8("not a zip")).errors[0]).toMatch(/not a ZIP/);
    expect(inspectSiteArchive(zip({ "index.html": "a", "INDEX.html": "b" })).errors).toEqual(['"/INDEX.html" appears twice with different letter cases; web addresses do not tell them apart.']);
    const many: Record<string, string> = { "index.html": "x" };
    for (let i = 0; i < MAX_FILES; i++) many[`p/${i}.txt`] = "x";
    expect(inspectSiteArchive(zip(many)).errors).toEqual([`The ZIP holds ${MAX_FILES + 1} files; the limit is ${MAX_FILES}.`]);
  });

  it("turns an inspection into the release manifest the serving code recognises, and nothing else does", () => {
    const r = inspectSiteArchive(sampleUploadedSiteZip());
    const snapshot = toUploadedSnapshot(r, { filename: "harbor.zip", archiveBytes: 1234 });
    expect(snapshot.kind).toBe("uploaded");
    expect(Object.keys(snapshot.files)).toHaveLength(9);
    expect(snapshot.files["/index.html"]!.name).toMatch(/^[0-9a-f]{64}\.html$/);
    expect(snapshot.source).toMatchObject({ filename: "harbor.zip", archiveBytes: 1234, files: 9, strippedFolder: null });
    expect(isUploadedSnapshot(snapshot)).toBe(true);
    expect(isUploadedSnapshot({ kind: "uploaded", files: {} })).toBe(false);
    expect(normalizeSnapshot(snapshot)).toBeNull();
    expect(RESTORABLE_SCHEMA_VERSIONS).toContain(UPLOADED_SCHEMA_VERSION);
    expect(stableJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });
});

describe("serving an uploaded site", () => {
  const snapshot = toUploadedSnapshot(inspectSiteArchive(zip({ "index.html": "home", "about.html": "about", "work/index.html": "work", "404.html": "lost", "css/site.css": "body{}", "docs/guide.pdf": "%PDF-1.4" })), { filename: "s.zip", archiveBytes: 1 });

  it("finds a file by its path, a page without its extension, a folder's index, and nothing for the rest", () => {
    expect(resolveUploadedPath(snapshot, "/")?.path).toBe("/index.html");
    expect(resolveUploadedPath(snapshot, "/index.html")?.path).toBe("/index.html");
    expect(resolveUploadedPath(snapshot, "/about")?.path).toBe("/about.html");
    expect(resolveUploadedPath(snapshot, "/about.html")?.path).toBe("/about.html");
    expect(resolveUploadedPath(snapshot, "/work")?.path).toBe("/work/index.html");
    expect(resolveUploadedPath(snapshot, "/work/")?.path).toBe("/work/index.html");
    expect(resolveUploadedPath(snapshot, "//css//site.css")?.path).toBe("/css/site.css");
    expect(resolveUploadedPath(snapshot, "/docs/guide.pdf")?.file.type).toBe("application/pdf");
    expect(resolveUploadedPath(snapshot, "/missing")).toBeNull();
    expect(resolveUploadedPath(snapshot, "/%ZZ")).toBeNull();
  });

  it("serves previews without caching or indexing, live files with the content hash as the ETag and a minute at the CDN", () => {
    const file = snapshot.files["/css/site.css"]!;
    const preview = uploadedFileHeaders(file, "preview");
    expect(preview.get("Content-Type")).toBe("text/css; charset=utf-8");
    expect(preview.get("Cache-Control")).toBe("no-store");
    expect(preview.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(preview.get("ETag")).toBe(`"${file.sha256}"`);
    const live = uploadedFileHeaders(file, "live");
    expect(live.get("Cache-Control")).toBe("public, max-age=0, s-maxage=60, must-revalidate");
    expect(live.get("X-Robots-Tag")).toBeNull();
    expect(live.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("answers nothing without the proxy's routing header", async () => {
    const res = await serveUploaded(new Request("http://x.preview.localhost/"), { mode: "preview", target: "x" });
    expect(res.status).toBe(404);
  });
});

describe("the proxy and uploaded sites", () => {
  const rewriteOf = (res: Response | undefined) => res?.headers.get("x-middleware-rewrite") ?? null;

  it("rewrites a preview hostname to the file handler and its form to the inquiry handler with the routing header, and refuses the handlers by path on the application host", async () => {
    const res = await proxy(new NextRequest("http://harbor.preview.localhost:3000/about?x=1", { headers: { host: "harbor.preview.localhost:3000" } }));
    expect(rewriteOf(res)).toBe("http://harbor.preview.localhost:3000/uploaded/preview/harbor/files/about?x=1");
    expect(res.headers.get("x-middleware-request-x-lw-uploaded-routing")).toBe("1");
    const root = await proxy(new NextRequest("http://harbor.preview.localhost:3000/", { headers: { host: "harbor.preview.localhost:3000" } }));
    expect(rewriteOf(root)).toBe("http://harbor.preview.localhost:3000/uploaded/preview/harbor/files");
    // A page of the site named like the form endpoint's segment stays a file; only /_lw/inquiry reaches the form handler.
    const inquiryPage = await proxy(new NextRequest("http://harbor.preview.localhost:3000/inquiry", { headers: { host: "harbor.preview.localhost:3000" } }));
    expect(rewriteOf(inquiryPage)).toBe("http://harbor.preview.localhost:3000/uploaded/preview/harbor/files/inquiry");
    const form = await proxy(new NextRequest("http://harbor.preview.localhost:3000/_lw/inquiry", { method: "POST", headers: { host: "harbor.preview.localhost:3000" } }));
    expect(rewriteOf(form)).toBe("http://harbor.preview.localhost:3000/uploaded/preview/harbor/inquiry");
    expect(form.headers.get("x-middleware-request-x-lw-uploaded-routing")).toBe("1");
    const direct = await proxy(new NextRequest("http://localhost:3000/uploaded/preview/harbor/files/", { headers: { host: "localhost:3000" } }));
    expect(direct.status).toBe(404);
    const spoofed = await proxy(new NextRequest("http://localhost:3000/app/sites", { headers: { host: "localhost:3000", "x-lw-uploaded-routing": "1", "x-lw-path": "/nope" } }));
    expect(spoofed.headers.get("x-middleware-request-x-lw-uploaded-routing")).toBeNull();
    expect(spoofed.headers.get("x-middleware-request-x-lw-path")).toBe("/app/sites");
  });
});

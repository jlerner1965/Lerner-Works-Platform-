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
    expect(r.leftOut).toEqual([{ path: "/.env", reason: "hidden" }]);
    expect(r.warnings).toEqual([
      "Left out, hidden: /.env.",
      "No 404.html: visitors who mistype an address get a plain not-found page.",
      "A form in the site does not post to the platform's inquiry endpoint; see the contact form snippet on the site's overview.",
    ]);
  });

  it("leaves out server-side files, unknown file types and unsafe names with a note each, and still refuses a path that leaves the archive, a missing index, case twins, too many files and what is not a ZIP", () => {
    const r = inspectSiteArchive(zip({ "index.html": "<p>hi</p>", "api/send.php": "<?php", "tool.exe": "MZ", "notes.docx": "x", "odd name?.html": "x", "a/../b.html": "x" }));
    expect(r.errors).toEqual(['"a/../b.html" cannot be served: a . or .. segment.']);
    expect(r.files.map((f) => f.path)).toEqual(["/index.html"]);
    expect(r.leftOut).toEqual([
      { path: "/api/send.php", reason: "server-side" },
      { path: "/tool.exe", reason: "server-side" },
      { path: "/notes.docx", reason: "not-served" },
      { path: "/odd name?.html", reason: "unsafe-name" },
    ]);
    expect(r.warnings).toEqual([
      "Left out as server-side code: /api/send.php, /tool.exe. A page or form that depends on it will not work here.",
      "Left out, not a kind of file a website serves: /notes.docx.",
      "Left out, names a web address cannot carry: /odd name?.html. Rename them to letters, digits, dots, dashes and underscores.",
      "No 404.html: visitors who mistype an address get a plain not-found page.",
    ]);
    expect(inspectSiteArchive(zip({ "about.html": "x", "css/a.css": "y" })).errors).toEqual(["No index.html at the top level of the ZIP: the site needs a home page there (a zipped folder is fine; its name is dropped)."]);
    expect(inspectSiteArchive(strToU8("not a zip")).errors[0]).toMatch(/not a ZIP/);
    expect(inspectSiteArchive(zip({ "index.html": "a", "INDEX.html": "b" })).errors).toEqual(['"/INDEX.html" appears twice with different letter cases; web addresses do not tell them apart.']);
    const many: Record<string, string> = { "index.html": "x" };
    for (let i = 0; i < MAX_FILES; i++) many[`p/${i}.txt`] = "x";
    expect(inspectSiteArchive(zip(many)).errors).toEqual([`The site holds ${(MAX_FILES + 1).toLocaleString()} files; the limit is ${MAX_FILES.toLocaleString()}.`]);
  });

  it("reads a repository download as the site it holds: housekeeping, hidden files, source files and scripts left out, Unicode names kept (B8)", () => {
    const r = inspectSiteArchive(zip({
      "lerner-site-main/.gitignore": "node_modules\n",
      "lerner-site-main/.github/workflows/deploy.yml": "name: deploy",
      "lerner-site-main/README.md": "# Site",
      "lerner-site-main/LICENSE": "MIT",
      "lerner-site-main/CNAME": "www.example.com",
      "lerner-site-main/vercel.json": "{}",
      "lerner-site-main/package.json": "{}",
      "lerner-site-main/index.html": "<!doctype html><title>Site</title>",
      "lerner-site-main/about.html": "About",
      "lerner-site-main/css/style.css": "body{}",
      "lerner-site-main/img/café.jpg": new Uint8Array([0xff, 0xd8, 0xff]),
      "lerner-site-main/scripts/build.sh": "#!/bin/sh",
      "lerner-site-main/src/app.tsx": "export default 1",
      "lerner-site-main/node_modules/x/index.js": "x",
      "lerner-site-main/node_modules/x/package.json": "{}",
    }));
    expect(r.errors).toEqual([]);
    expect(r.strippedFolder).toBe("lerner-site-main");
    expect(r.root).toBeNull();
    expect(r.files.map((f) => f.path)).toEqual(["/about.html", "/css/style.css", "/img/café.jpg", "/index.html"]);
    expect(r.leftOut.map((l) => `${l.reason}:${l.path}`)).toEqual([
      "hidden:/.gitignore",
      "hidden:/.github/workflows/deploy.yml",
      "housekeeping:/README.md",
      "housekeeping:/LICENSE",
      "housekeeping:/CNAME",
      "housekeeping:/vercel.json",
      "housekeeping:/package.json",
      "server-side:/scripts/build.sh",
      "not-served:/src/app.tsx",
      "dependencies:2 files under node_modules",
    ]);
    expect(r.warnings).toEqual([
      "Left out as server-side code: /scripts/build.sh. A page or form that depends on it will not work here.",
      "Left out, not a kind of file a website serves: /src/app.tsx.",
      "Left out, repository housekeeping: /README.md, /LICENSE, /CNAME, /vercel.json, /package.json.",
      "Left out, hidden: /.gitignore, /.github/workflows/deploy.yml.",
      "Left out: 2 files under node_modules.",
      "No 404.html: visitors who mistype an address get a plain not-found page.",
    ]);
  });

  it("takes the site from its build folder, found on its own or named, and says when a project still has to be built (B8)", () => {
    const built = inspectSiteArchive(zip({ "package.json": "{}", "src/app.tsx": "x", "dist/index.html": "hi", "dist/assets/a.css": "body{}" }));
    expect(built.errors).toEqual([]);
    expect(built.root).toBe("dist");
    expect(built.rootDetected).toBe(true);
    expect(built.files.map((f) => f.path)).toEqual(["/assets/a.css", "/index.html"]);
    expect(built.leftOut).toEqual([{ path: '2 files outside "dist"', reason: "outside-root" }]);
    expect(built.warnings[0]).toBe('The site was taken from the folder "dist" of the ZIP; the 2 files outside it were left out.');
    const named = inspectSiteArchive(zip({ "index.html": "top", "site/public/index.html": "inner", "site/public/a.css": "" }), { root: "/site/public/" });
    expect(named.errors).toEqual([]);
    expect(named.root).toBe("site/public");
    expect(named.rootDetected).toBe(false);
    expect(named.files.map((f) => f.path)).toEqual(["/a.css", "/index.html"]);
    expect(inspectSiteArchive(zip({ "index.html": "x" }), { root: "dist" }).errors).toEqual(['No index.html in the folder "dist" of the ZIP.']);
    expect(inspectSiteArchive(zip({ "index.html": "x" }), { root: "../x" }).errors).toEqual(["The folder must be a plain path inside the ZIP, such as dist or docs/site."]);
    expect(inspectSiteArchive(zip({ "dist/index.html": "a", "build/index.html": "b" })).errors).toEqual(["No index.html at the top level, and more than one folder holds one (dist, build): name the folder that is the site."]);
    const source = inspectSiteArchive(zip({ "package.json": "{}", "src/App.tsx": "x", "src/index.css": "" }));
    expect(source.errors).toEqual(["No index.html at the top level, and this looks like a project that has to be built first (package.json, source files). Build it, then zip the output folder (often dist, build, out or public), or name that folder when uploading."]);
    const nothing = inspectSiteArchive(zip({ "README.md": "x", "LICENSE": "y" }));
    expect(nothing.errors).toEqual(["The ZIP holds no files a website serves; everything in it was left out (see the notes)."]);
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
    expect(resolveUploadedPath(snapshot, "/about/")?.path).toBe("/about.html");
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
    // The platform's own headers ride on its pages, not on an uploaded site's files (its handler sets them, its _headers may override).
    expect(spoofed.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(spoofed.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("x-frame-options")).toBeNull();
    // Trailing slashes: the platform's pages are normalised by the proxy; an uploaded site keeps its own.
    const slashed = await proxy(new NextRequest("http://localhost:3000/app/sites/", { headers: { host: "localhost:3000" } }));
    expect(slashed.status).toBe(308);
    expect(slashed.headers.get("location")).toBe("http://localhost:3000/app/sites");
    const kept = await proxy(new NextRequest("http://harbor.preview.localhost:3000/events/", { headers: { host: "harbor.preview.localhost:3000" } }));
    expect(rewriteOf(kept)).toBe("http://harbor.preview.localhost:3000/uploaded/preview/harbor/files/events/");
  });
});

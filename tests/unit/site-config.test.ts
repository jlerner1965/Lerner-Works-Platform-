import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { applyHeaderRules, matchPattern, matchRedirect, parseHeaders, parseRedirects } from "@/server/uploaded/site-config";
import { inspectSiteArchive, toUploadedSnapshot } from "@/server/uploaded/archive";
import { hashDeployToken, isDeployTokenShaped } from "@/server/uploaded/deploy";

/**
 * A built site's own hosting configuration (B9): `_redirects` and `_headers` in the Netlify
 * format, read into the manifest and applied by the file handler; and the shape of a deploy
 * token. Pure functions.
 */
const REDIRECTS = `# generated from vercel.json
/compare/  /moving/  301
/sitemap.xml  /sitemap-index.xml  302
/blog/*  /news/:splat  301
/old-app/*  /app/index.html  200
/gone  /  404
/search?q=x  /find  301
/weird  /x  418
/typo /x 301 extra
/api/*  https://api.example.com/:splat  307
/rewrite-outside  https://elsewhere.example/  200
`;

const HEADERS = `/*
  Content-Security-Policy: default-src 'self'; script-src 'self'
  Strict-Transport-Security: max-age=63072000; includeSubDomains
  X-Frame-Options: DENY
  X-Powered-By: nothing
/_astro/*
  Cache-Control: public, max-age=31536000, immutable
/favicons/*
  Cache-Control: public, max-age=604800
junk line without indent
/bad/:param/*
  Cache-Control: no-cache
`;

describe("_redirects", () => {
  it("reads exact, splat, rewrite, 404 and outside redirects, and ignores what it does not understand", () => {
    const r = parseRedirects(REDIRECTS);
    expect(r.redirects).toEqual([
      { from: "/compare/", to: "/moving/", status: 301 },
      { from: "/sitemap.xml", to: "/sitemap-index.xml", status: 302 },
      { from: "/blog/*", to: "/news/:splat", status: 301 },
      { from: "/old-app/*", to: "/app/index.html", status: 200 },
      { from: "/gone", to: "/", status: 404 },
      { from: "/api/*", to: "https://api.example.com/:splat", status: 307 },
    ]);
    expect(r.ignored).toEqual(["/search?q=x  /find  301", "/weird  /x  418", "/typo /x 301 extra", "/rewrite-outside  https://elsewhere.example/  200"]);
  });

  it("matches a request with or without its trailing slash and fills the splat", () => {
    const { redirects } = parseRedirects(REDIRECTS);
    expect(matchRedirect(redirects, "/compare")).toEqual({ to: "/moving/", status: 301 });
    expect(matchRedirect(redirects, "/compare/")).toEqual({ to: "/moving/", status: 301 });
    expect(matchRedirect(redirects, "/blog/2026/hello")).toEqual({ to: "/news/2026/hello", status: 301 });
    expect(matchRedirect(redirects, "/blog/")).toEqual({ to: "/news/", status: 301 });
    expect(matchRedirect(redirects, "/blog")).toEqual({ to: "/news/", status: 301 });
    expect(matchRedirect(redirects, "/api/v1/x")).toEqual({ to: "https://api.example.com/v1/x", status: 307 });
    expect(matchRedirect(redirects, "/gone")).toEqual({ to: "/", status: 404 });
    expect(matchRedirect(redirects, "/about")).toBeNull();
    expect(matchRedirect(undefined, "/about")).toBeNull();
    expect(matchPattern("/*", "/anything/at/all")).toEqual({ matched: true, splat: "anything/at/all" });
    expect(matchPattern("/docs*", "/docs-old")).toEqual({ matched: true, splat: "-old" });
  });
});

describe("_headers", () => {
  it("reads rules with their allowed headers only", () => {
    const h = parseHeaders(HEADERS);
    expect(h.rules).toEqual([
      { pattern: "/*", headers: { "content-security-policy": "default-src 'self'; script-src 'self'", "strict-transport-security": "max-age=63072000; includeSubDomains", "x-frame-options": "DENY" } },
      { pattern: "/_astro/*", headers: { "cache-control": "public, max-age=31536000, immutable" } },
      { pattern: "/favicons/*", headers: { "cache-control": "public, max-age=604800" } },
    ]);
    expect(h.ignored).toEqual(["/*: X-Powered-By", "junk line without indent", "/bad/:param/*", "Cache-Control: no-cache"]);
  });

  it("applies matching rules in order on the live domain and keeps a preview's caching and noindex", () => {
    const { rules } = parseHeaders(HEADERS);
    const live = new Headers({ "Content-Type": "text/css; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate", "X-Content-Type-Options": "nosniff" });
    applyHeaderRules(live, rules, "/_astro/site.css", "live");
    expect(live.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(live.get("content-security-policy")).toBe("default-src 'self'; script-src 'self'");
    expect(live.get("x-frame-options")).toBe("DENY");
    expect(live.get("content-type")).toBe("text/css; charset=utf-8");
    const page = new Headers({ "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate" });
    applyHeaderRules(page, rules, "/about/", "live");
    expect(page.get("cache-control")).toBe("public, max-age=0, s-maxage=60, must-revalidate");
    expect(page.get("strict-transport-security")).toBe("max-age=63072000; includeSubDomains");
    const preview = new Headers({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
    applyHeaderRules(preview, [...rules, { pattern: "/*", headers: { "x-robots-tag": "all" } }], "/_astro/site.css", "preview");
    expect(preview.get("cache-control")).toBe("no-store");
    expect(preview.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(preview.get("content-security-policy")).toBe("default-src 'self'; script-src 'self'");
  });
});

describe("an archive with its own configuration", () => {
  it("reads _redirects and _headers into the inspection and the manifest instead of serving them", () => {
    const r = inspectSiteArchive(zipSync({ "index.html": strToU8("home"), "moving/index.html": strToU8("moving"), _redirects: strToU8(REDIRECTS), _headers: strToU8(HEADERS) }));
    expect(r.errors).toEqual([]);
    expect(r.files.map((f) => f.path)).toEqual(["/index.html", "/moving/index.html"]);
    expect(r.redirects).toHaveLength(6);
    expect(r.headerRules).toHaveLength(3);
    expect(r.leftOut).toEqual([
      { path: "/_redirects", reason: "config" },
      { path: "/_headers", reason: "config" },
    ]);
    expect(r.warnings).toContain("Read 6 redirects from _redirects and 3 header rules from _headers; they apply on the live domain (previews keep their own caching and noindex).");
    expect(r.warnings.some((w) => w.startsWith("In _redirects, 4 lines are not understood"))).toBe(true);
    expect(r.warnings.some((w) => w.startsWith("In _headers, 4 lines are not understood"))).toBe(true);
    const snapshot = toUploadedSnapshot(r, { filename: "s.zip", archiveBytes: 1, deploy: { label: "GitHub Actions", commit: "abc1234", ref: "main" } });
    expect(snapshot.redirects).toHaveLength(6);
    expect(snapshot.headers).toHaveLength(3);
    expect(snapshot.source.deploy).toEqual({ label: "GitHub Actions", commit: "abc1234", ref: "main" });
    const plain = toUploadedSnapshot(inspectSiteArchive(zipSync({ "index.html": strToU8("home") })), { filename: "s.zip", archiveBytes: 1 });
    expect(plain.redirects).toBeUndefined();
    expect(plain.headers).toBeUndefined();
  });
});

describe("deploy tokens", () => {
  it("have a fixed shape and a stable hash", () => {
    expect(isDeployTokenShaped(`lwd_${"a".repeat(40)}`)).toBe(true);
    expect(isDeployTokenShaped("lwd_short")).toBe(false);
    expect(isDeployTokenShaped(`ghp_${"a".repeat(40)}`)).toBe(false);
    expect(hashDeployToken("lwd_x")).toBe(hashDeployToken("lwd_x"));
    expect(hashDeployToken("lwd_x")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDeployToken("lwd_x")).not.toBe(hashDeployToken("lwd_y"));
  });
});

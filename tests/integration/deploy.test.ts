process.env.UPLOAD_PART_BYTES = "4096";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { seedInfo, withUser, endPool, adminClient } from "./helpers";
import { resetConfigForTests } from "@/server/config";
import { loadSiteContext, type SiteContext } from "@/server/data/access";
import { createSiteFromPreset } from "@/server/data/sites";
import { createDeployToken, listDeployTokens, resolveDeployToken, revokeDeployToken } from "@/server/uploaded/deploy";
import { resolveUploadedLive, resolveUploadedPreview, serveUploaded } from "@/server/uploaded/serve";
import { sampleUploadedSiteFiles } from "@/server/demo/uploaded-sample";
import { POST as begin } from "@/app/api/deploy/begin/route";
import { PUT as part } from "@/app/api/deploy/part/route";
import { POST as complete } from "@/app/api/deploy/complete/route";

/**
 * Push to deploy (site-building programme B9, UP-08 and UP-09): a deploy token created on
 * the site lets a CI hand the built folder to the deploy endpoints, which check and publish
 * it as the next release with the commit recorded; the token acts as its creator and dies
 * with their rights or its revocation; the site's own _redirects and _headers are read into
 * the release and applied when the site is served.
 */
const { users, organizations } = seedInfo();
const owner = users.owner;
const admin = adminClient();

beforeAll(() => resetConfigForTests());

afterAll(async () => {
  await admin.end();
  await endPool();
});

async function uploadedSite(prefix: string): Promise<{ siteId: string; siteKey: string; ctx: SiteContext }> {
  const siteKey = `${prefix}-${Date.now().toString(36)}`;
  const { siteId } = await createSiteFromPreset(owner, { organizationId: organizations.pineHollow, key: siteKey, name: "Harbor Lane Studio", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: {}, siteType: "uploaded" });
  const ctx = (await withUser(owner, (db) => loadSiteContext(db, siteId)))!;
  return { siteId, siteKey, ctx };
}

const REDIRECTS = "/compare/ /moving/ 301\n/old-home /index.html 200\n";
const HEADERS = "/*\n  Content-Security-Policy: default-src 'self'\n  X-Frame-Options: DENY\n/css/*\n  Cache-Control: public, max-age=31536000, immutable\n";

function builtSite(headline: string): Uint8Array {
  const files = sampleUploadedSiteFiles();
  const entries: Record<string, Uint8Array> = {};
  for (const [name, text] of Object.entries(files)) entries[name] = strToU8(name === "index.html" ? text.replace("Furniture made to be handed down.", headline) : text);
  entries["moving/index.html"] = strToU8("<!doctype html><title>Moving</title><h1>Moving</h1>");
  entries["_redirects"] = strToU8(REDIRECTS);
  entries["_headers"] = strToU8(HEADERS);
  return zipSync(entries);
}

const json = (url: string, body: unknown, token: string | null) => new Request(url, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

/** Runs the deploy exactly as public/deploy.sh does: begin, the parts, complete. */
async function deploy(token: string, zip: Uint8Array, extra: Record<string, string> = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const opened = await begin(json("https://app.example/api/deploy/begin", { filename: "site.zip", size: zip.byteLength }, token));
  const session = (await opened.json()) as { ok: boolean; session?: string; partBytes?: number; parts?: number; error?: string };
  if (!session.ok) return { status: opened.status, body: session };
  for (let i = 0; i < session.parts!; i++) {
    const chunk = zip.subarray(i * session.partBytes!, Math.min((i + 1) * session.partBytes!, zip.byteLength));
    const res = await part(new Request(`https://app.example/api/deploy/part?session=${session.session}&index=${i}`, { method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream" }, body: new Uint8Array(chunk) }));
    expect(res.status).toBe(200);
  }
  const done = await complete(json("https://app.example/api/deploy/complete", { session: session.session, ...extra }, token));
  return { status: done.status, body: (await done.json()) as Record<string, unknown> };
}

const routed = (url: string) => new Request(url, { headers: { "x-lw-uploaded-routing": "1" } });

describe("push to deploy (B9)", () => {
  it("publishes a built site handed over with a deploy token, records the commit, and serves the site's own redirects and headers", async () => {
    const { siteId, siteKey, ctx } = await uploadedSite("dep-a");
    // An editor of the site cannot create a token; the owner can, and the token is shown once.
    await expect(withUser(users.editorA, async (db) => createDeployToken(db, (await loadSiteContext(db, siteId))!, users.editorA, "x"))).rejects.toThrow(/Only owners and publishers/);
    const created = await withUser(owner, (db) => createDeployToken(db, ctx, owner, "GitHub Actions"));
    expect(created.token).toMatch(/^lwd_[0-9a-f]{40}$/);
    const listed = await withUser(owner, (db) => listDeployTokens(db, siteId));
    expect(listed.map((t) => ({ label: t.label, revoked: t.revokedAt }))).toEqual([{ label: "GitHub Actions", revoked: null }]);
    await expect(withUser(owner, (db) => db`select token_hash from public.site_deploy_tokens where site_id = ${siteId}`)).rejects.toThrow(/permission denied/);
    expect(await resolveDeployToken(`Bearer ${created.token}`)).toMatchObject({ id: created.id, siteId, createdBy: owner, label: "GitHub Actions" });
    expect(await resolveDeployToken("Bearer lwd_nope")).toBeNull();
    expect(await resolveDeployToken(null)).toBeNull();

    // The deploy, as the script does it: v1 with the commit and branch recorded.
    const first = await deploy(created.token, builtSite("Deployed from CI."), { commit: "0123456789abcdef0123456789abcdef01234567", ref: "main" });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ok: true, version: 1, files: 10 });
    const release = (await resolveUploadedPreview(siteKey))!;
    expect(release.snapshot.source.deploy).toEqual({ label: "GitHub Actions", commit: "0123456789abcdef0123456789abcdef01234567", ref: "main" });
    expect(release.snapshot.redirects).toEqual([
      { from: "/compare/", to: "/moving/", status: 301 },
      { from: "/old-home", to: "/index.html", status: 200 },
    ]);
    expect(release.snapshot.headers).toHaveLength(2);
    const row = (await admin<{ reason: string; actor: string | null }[]>`select r.reason, r.actor_id::text as actor from public.releases r where r.id = ${release.releaseId}`)[0]!;
    expect(row.reason).toBe("Push to deploy (GitHub Actions): main @ 0123456");
    expect(row.actor).toBe(owner);
    const used = (await withUser(owner, (db) => listDeployTokens(db, siteId)))[0]!;
    expect(used.lastUsedAt).not.toBeNull();

    // The redirects and headers on the preview hostname: a redirect, a rewrite, the CSP; caching and noindex stay the preview's.
    const redirected = await serveUploaded(routed(`http://${siteKey}.preview.localhost/compare`), { mode: "preview", target: siteKey, path: ["compare"] });
    expect(redirected.status).toBe(301);
    expect(redirected.headers.get("location")).toBe("/moving/");
    const rewritten = await serveUploaded(routed(`http://${siteKey}.preview.localhost/old-home`), { mode: "preview", target: siteKey, path: ["old-home"] });
    expect(rewritten.status).toBe(200);
    expect(Buffer.from(await rewritten.arrayBuffer()).toString("utf8")).toContain("Deployed from CI.");
    const css = await serveUploaded(routed(`http://${siteKey}.preview.localhost/css/site.css`), { mode: "preview", target: siteKey, path: ["css", "site.css"] });
    expect(css.headers.get("content-security-policy")).toBe("default-src 'self'");
    expect(css.headers.get("x-frame-options")).toBe("DENY");
    expect(css.headers.get("cache-control")).toBe("no-store");
    expect(css.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    // On the live domain the site's Cache-Control applies too.
    const host = `${siteKey}.example`;
    await admin`insert into public.domains (organization_id, site_id, normalized_host, status, is_canonical, verified_at) values (${ctx.site.organizationId}, ${siteId}, ${host}, 'active', true, now())`;
    await admin`update public.sites set mode = 'live' where id = ${siteId}`;
    expect((await resolveUploadedLive(host))?.mode).toBe("live");
    const liveCss = await serveUploaded(routed(`https://${host}/css/site.css`), { mode: "host", target: host, path: ["css", "site.css"] });
    expect(liveCss.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(liveCss.headers.get("content-security-policy")).toBe("default-src 'self'");
    const livePage = await serveUploaded(routed(`https://${host}/about`), { mode: "host", target: host, path: ["about"] });
    expect(livePage.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=60, must-revalidate");
    expect(livePage.headers.get("x-frame-options")).toBe("DENY");

    // A second deploy is v2; a refused site is answered with the reasons and publishes nothing.
    const second = await deploy(created.token, builtSite("Second deploy."), { commit: "89abcdef0123456789abcdef0123456789abcdef", ref: "main" });
    expect(second.body).toMatchObject({ ok: true, version: 2 });
    const bad = await deploy(created.token, zipSync({ "package.json": strToU8("{}"), "src/App.tsx": strToU8("x") }));
    expect(bad.status).toBe(422);
    expect(bad.body).toMatchObject({ ok: false });
    expect(String((bad.body.errors as string[])[0])).toMatch(/has to be built first/);
    expect((await resolveUploadedLive(host))!.version).toBe(2);

    // Revoked, the token is refused; so is a wrong or missing one.
    expect(await withUser(owner, (db) => revokeDeployToken(db, ctx, created.id))).toBe(true);
    expect(await withUser(owner, (db) => revokeDeployToken(db, ctx, created.id))).toBe(false);
    const revoked = await deploy(created.token, builtSite("Third."));
    expect(revoked.status).toBe(401);
    expect(String(revoked.body.error)).toMatch(/missing, unknown or revoked/);
    expect((await begin(json("https://app.example/api/deploy/begin", { filename: "x", size: 1 }, null))).status).toBe(401);
    expect((await begin(new Request("https://app.example/api/deploy/begin", { method: "POST", headers: { authorization: `Bearer ${created.token}` }, body: "not json" }))).status).toBe(400);
  });

  it("acts as the person who created the token, so the token dies with their rights", async () => {
    const { siteId, ctx } = await uploadedSite("dep-b");
    // publisherB joins the organization and is made a publisher of this site, creates a token, then loses the role.
    await withUser(owner, (db) => db`select public.set_organization_membership(${organizations.pineHollow}, ${users.publisherB}, 'member')`);
    await withUser(owner, (db) => db`select public.set_site_membership(${siteId}, ${users.publisherB}, 'publisher')`);
    const created = await withUser(users.publisherB, async (db) => createDeployToken(db, (await loadSiteContext(db, siteId))!, users.publisherB, "publisher's token"));
    const ok = await deploy(created.token, builtSite("By the publisher."), { ref: "main" });
    expect(ok.body).toMatchObject({ ok: true, version: 1 });
    const actor = (await admin<{ actor: string }[]>`select r.actor_id::text as actor from public.releases r join public.sites s on s.id = r.site_id where s.id = ${siteId} order by r.version desc limit 1`)[0]!;
    expect(actor.actor).toBe(users.publisherB);
    await withUser(owner, (db) => db`select public.remove_site_membership(${siteId}, ${users.publisherB})`);
    const refused = await deploy(created.token, builtSite("After removal."), { ref: "main" });
    expect(refused.status).toBe(403);
    expect(String(refused.body.error)).toMatch(/no longer has access to the site|may no longer publish/);
    // The owner still sees and can revoke it.
    expect(await withUser(owner, (db) => revokeDeployToken(db, ctx, created.id))).toBe(true);
  });
});

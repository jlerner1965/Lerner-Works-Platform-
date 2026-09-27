import { afterAll, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { seedInfo, withUser, withAnon, endPool, adminClient, key } from "./helpers";
import { loadSiteContext } from "@/server/data/access";
import { createSiteFromPreset } from "@/server/data/sites";
import { getStorage } from "@/server/media/storage";
import { publishUploadedSite, listUploadedReleases } from "@/server/uploaded/publish";
import { resolveUploadedPreview, resolveUploadedLive, serveUploaded, handleUploadedInquiry } from "@/server/uploaded/serve";
import { restoreRelease } from "@/server/publishing/activate";
import { deleteSite } from "@/server/data/removal";
import { sampleUploadedSiteFiles, sampleUploadedSiteZip } from "@/server/demo/uploaded-sample";

/**
 * Uploaded sites (site-building programme B7, UP-01 to UP-04): a site built anywhere is
 * uploaded as a ZIP and published as an immutable release; its files are served on a preview
 * hostname and on its live domain with clean addresses, its own 404 page and content-hash
 * caching; its contact form lands in the inbox; a second upload is a new release and an
 * earlier one can be restored; removal takes the files no other site's release carries.
 */
const { users, organizations } = seedInfo();
const owner = users.owner;
const admin = adminClient();

afterAll(async () => {
  await admin.end();
  await endPool();
});

async function uploadedSite(prefix: string) {
  const siteKey = `${prefix}-${Date.now().toString(36)}`;
  const { siteId } = await createSiteFromPreset(owner, { organizationId: organizations.pineHollow, key: siteKey, name: "Harbor Lane Studio", preset: "community_guide", timeZone: "America/Denver", mode: "demo", contact: {}, siteType: "uploaded" });
  const site = (await withUser(owner, (db) => loadSiteContext(db, siteId)))!.site;
  return { siteId, siteKey, site };
}

const routed = (url: string, init: RequestInit = {}) => new Request(url, { ...init, headers: { "x-lw-uploaded-routing": "1", ...(init.headers as Record<string, string> | undefined) } });

describe("uploaded sites (B7)", () => {
  it("is created without pages, publishes a ZIP as release v1 with its files in public storage, and serves them on the preview hostname", async () => {
    const { siteId, siteKey, site } = await uploadedSite("up-a");
    expect(site.siteType).toBe("uploaded");
    expect((await admin`select count(*)::int as n from public.content_items where site_id = ${siteId}`)[0]!.n).toBe(0);
    expect(await resolveUploadedPreview(siteKey)).toBeNull();

    const zip = sampleUploadedSiteZip();
    const result = await publishUploadedSite(owner, site, zip, { filename: "harbor-lane-studio.zip", reason: "first upload", idempotencyKey: key() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.release).toMatchObject({ version: 1, outcome: "published", files: 9 });
    const storage = getStorage();
    const release = (await resolveUploadedPreview(siteKey))!;
    expect(release.version).toBe(1);
    expect(Object.keys(release.snapshot.files)).toHaveLength(9);
    for (const f of Object.values(release.snapshot.files)) expect(await storage.existsPublic(f.name)).toBe(true);
    const row = (await admin`select schema_version, reason, snapshot->'source'->>'filename' as filename from public.releases where id = ${release.releaseId}`)[0]!;
    expect(row).toMatchObject({ schemaVersion: 101, reason: "first upload", filename: "harbor-lane-studio.zip" });
    const audit = await admin`select metadata from public.audit_events where action = 'release.activated' and entity_id = ${release.releaseId}`;
    expect(audit[0]!.metadata).toMatchObject({ version: 1, uploaded: true, files: 9 });

    // The home page, a page without its extension, a stylesheet, the 404 page, a conditional request, robots.
    const home = await serveUploaded(routed(`http://${siteKey}.preview.localhost/`), { mode: "preview", target: siteKey });
    expect(home.status).toBe(200);
    expect(home.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(home.headers.get("cache-control")).toBe("no-store");
    expect(home.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await home.text()).toContain("Furniture made to be handed down.");
    const about = await serveUploaded(routed(`http://${siteKey}.preview.localhost/about`), { mode: "preview", target: siteKey, path: ["about"] });
    expect(about.status).toBe(200);
    expect(await about.text()).toContain("About the studio");
    const css = await serveUploaded(routed(`http://${siteKey}.preview.localhost/css/site.css`), { mode: "preview", target: siteKey, path: ["css", "site.css"] });
    expect(css.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(css.headers.get("etag")).toBe(`"${release.snapshot.files["/css/site.css"]!.sha256}"`);
    const cached = await serveUploaded(routed(`http://${siteKey}.preview.localhost/css/site.css`, { headers: { "if-none-match": css.headers.get("etag")! } }), { mode: "preview", target: siteKey, path: ["css", "site.css"] });
    expect(cached.status).toBe(304);
    const missing = await serveUploaded(routed(`http://${siteKey}.preview.localhost/nope`), { mode: "preview", target: siteKey, path: ["nope"] });
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("That page is not here");
    const robots = await serveUploaded(routed(`http://${siteKey}.preview.localhost/robots.txt`), { mode: "preview", target: siteKey, path: ["robots.txt"] });
    expect(await robots.text()).toContain("Disallow: /");
    const head = await serveUploaded(routed(`http://${siteKey}.preview.localhost/`, { method: "HEAD" }), { mode: "preview", target: siteKey });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    // Not through the proxy: nothing.
    expect((await serveUploaded(new Request(`http://${siteKey}.preview.localhost/`), { mode: "preview", target: siteKey })).status).toBe(404);
  });

  it("takes a second upload as release v2, keeps every earlier file, restores v1, and lists the releases", async () => {
    const { siteId, siteKey, site } = await uploadedSite("up-b");
    const first = await publishUploadedSite(owner, site, sampleUploadedSiteZip(), { filename: "v1.zip", reason: null, idempotencyKey: key() });
    expect(first.ok).toBe(true);
    const files = sampleUploadedSiteFiles();
    files["index.html"] = files["index.html"]!.replace("Furniture made to be handed down.", "Second version.");
    const second = await publishUploadedSite(owner, site, zipSync(Object.fromEntries(Object.entries(files).map(([p, t]) => [p, strToU8(t)]))), { filename: "v2.zip", reason: "new headline", idempotencyKey: key() });
    expect(second.ok && second.release.version).toBe(2);
    const v2 = (await resolveUploadedPreview(siteKey))!;
    expect(v2.version).toBe(2);
    const v1Name = first.ok ? first.inspection.files.find((f) => f.path === "/index.html")!.sha256 : "";
    expect(v2.snapshot.files["/index.html"]!.sha256).not.toBe(v1Name);
    const storage = getStorage();
    expect(await storage.existsPublic(`${v1Name}.html`)).toBe(true);
    expect(await (await serveUploaded(routed(`http://${siteKey}.preview.localhost/`), { mode: "preview", target: siteKey })).text()).toContain("Second version.");
    // The same ZIP again with the same idempotency key is the same release.
    const again = await publishUploadedSite(owner, site, sampleUploadedSiteZip(), { filename: "v1.zip", reason: null, idempotencyKey: "repeat-" + siteKey });
    const againMore = await publishUploadedSite(owner, site, sampleUploadedSiteZip(), { filename: "v1.zip", reason: null, idempotencyKey: "repeat-" + siteKey });
    expect(again.ok && againMore.ok && again.release.releaseId === againMore.release.releaseId && againMore.release.outcome).toBe("already_published");
    const restored = await restoreRelease(owner, first.ok ? first.release.releaseId : "", key(), "back to the first version");
    expect(restored.outcome).toBe("restored");
    expect(await (await serveUploaded(routed(`http://${siteKey}.preview.localhost/`), { mode: "preview", target: siteKey })).text()).toContain("Furniture made to be handed down.");
    const releases = await withUser(owner, (db) => listUploadedReleases(db, siteId));
    expect(releases.map((r) => r.version)).toEqual([4, 3, 2, 1]);
    expect(releases[0]!.restoredFromReleaseId).toBe(first.ok ? first.release.releaseId : null);
    expect(releases[3]!.source).toMatchObject({ filename: "v1.zip", files: 9 });
    // An editor cannot publish, and a structured site takes no upload.
    await expect(publishUploadedSite(users.editorA, site, sampleUploadedSiteZip(), { filename: "x.zip", reason: null, idempotencyKey: key() })).rejects.toMatchObject({ code: "42501" });
    const structured = (await withUser(owner, (db) => loadSiteContext(db, seedInfo().sites.pineHollow)))!.site;
    expect((await publishUploadedSite(owner, structured, sampleUploadedSiteZip(), { filename: "x.zip", reason: null, idempotencyKey: key() })).ok).toBe(false);
  });

  it("stores the contact form's post in the inbox and sends the visitor on; refuses the honeypot and an empty email", async () => {
    const { siteId, siteKey, site } = await uploadedSite("up-c");
    await publishUploadedSite(owner, site, sampleUploadedSiteZip(), { filename: "v1.zip", reason: null, idempotencyKey: key() });
    const post = (fields: Record<string, string>) =>
      handleUploadedInquiry(
        routed(`http://${siteKey}.preview.localhost/_lw/inquiry`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", origin: `http://${siteKey}.preview.localhost`, "sec-fetch-site": "same-origin", referer: `http://${siteKey}.preview.localhost/contact` },
          body: new URLSearchParams(fields).toString(),
        }),
        { mode: "preview", target: siteKey },
      );
    const sent = await post({ name: "Ada Lovelace", email: "ada@example.com", message: "A walnut table for eight.", next: "/thanks", website: "" });
    expect(sent.status).toBe(303);
    expect(sent.headers.get("location")).toMatch(/^\/thanks\?sent=LW-[0-9A-F]{8}$/);
    const rows = await admin`select name, email, message, source_path from public.inquiries where site_id = ${siteId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com", sourcePath: "/contact" });
    expect((await post({ name: "Robot", email: "r@example.com", message: "x", website: "http://spam" })).status).toBe(400);
    const invalid = await post({ name: "No Email", email: "", message: "x", next: "/thanks" });
    expect(invalid.status).toBe(422);
    expect(await invalid.text()).toContain("Enter your email address.");
    expect((await admin`select count(*)::int as n from public.inquiries where site_id = ${siteId}`)[0]!.n).toBe(1);
  });

  it("serves the live domain once the site is live, tells the proxy the host's kind, redirects an alias to the canonical host, and removal takes the files no other site uses", async () => {
    const a = await uploadedSite("up-d");
    const b = await uploadedSite("up-e");
    // Both sites carry the sample plus one page of their own, shared by the two of them and no other site.
    const files = sampleUploadedSiteFiles();
    files["pair.html"] = `<html><body>${a.siteKey}</body></html>`;
    const pairZip = zipSync(Object.fromEntries(Object.entries(files).map(([p, t]) => [p, strToU8(t)])));
    await publishUploadedSite(owner, a.site, pairZip, { filename: "v1.zip", reason: null, idempotencyKey: key() });
    await publishUploadedSite(owner, b.site, pairZip, { filename: "v1.zip", reason: null, idempotencyKey: key() });
    const host = `${a.siteKey}.example`;
    const alias = `www.${a.siteKey}.example`;
    expect((await withAnon((db) => db<{ type: string | null }[]>`select public.get_host_site_type(${host}) as type`))[0]!.type).toBeNull();
    await admin`insert into public.domains (organization_id, site_id, normalized_host, status, is_canonical, verified_at) values (${a.site.organizationId}, ${a.siteId}, ${host}, 'active', true, now()), (${a.site.organizationId}, ${a.siteId}, ${alias}, 'active', false, now())`;
    await admin`update public.sites set mode = 'live' where id = ${a.siteId}`;
    expect((await withAnon((db) => db<{ type: string | null }[]>`select public.get_host_site_type(${host}) as type`))[0]!.type).toBe("uploaded");
    expect((await withAnon((db) => db<{ type: string | null }[]>`select public.get_host_site_type(${"pinehollow.example"}) as type`))[0]!.type).toBeNull();
    const live = (await resolveUploadedLive(host))!;
    expect(live.mode).toBe("live");
    const page = await serveUploaded(routed(`https://${host}/work`), { mode: "host", target: host, path: ["work"] });
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=60, must-revalidate");
    expect(page.headers.get("x-robots-tag")).toBeNull();
    const redirected = await serveUploaded(routed(`https://${alias}/work`), { mode: "host", target: alias, path: ["work"] });
    expect(redirected.status).toBe(308);
    expect(redirected.headers.get("location")).toBe(`https://${host}/work`);
    // A live site is not deleted; back in demonstration mode with its domains disabled, it is.
    await expect(deleteSite(owner, a.siteId, a.siteKey)).rejects.toThrow(/live on a domain/);
    await admin`update public.sites set mode = 'demo' where id = ${a.siteId}`;
    await admin`update public.domains set status = 'disabled' where site_id = ${a.siteId}`;
    const pairName = (await resolveUploadedPreview(a.siteKey))!.snapshot.files["/pair.html"]!.name;
    const storage = getStorage();
    const first = await deleteSite(owner, a.siteId, a.siteKey);
    expect(first.storage.publicCopies).toBe(0); // site B's release carries every one of its files
    expect(await storage.existsPublic(pairName)).toBe(true);
    const second = await deleteSite(owner, b.siteId, b.siteKey);
    expect(second.storage.publicCopies).toBe(1); // the pair's own page; the sample's files are carried by the earlier sites of this run
    expect(await storage.existsPublic(pairName)).toBe(false);
    expect(await resolveUploadedPreview(b.siteKey)).toBeNull();
  });
});

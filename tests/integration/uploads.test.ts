process.env.UPLOAD_PART_BYTES = "4096";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { strToU8, unzipSync, zipSync } from "fflate";
import { seedInfo, withUser, endPool, adminClient, key } from "./helpers";
import { resetConfigForTests } from "@/server/config";
import { loadSiteContext, type SiteContext } from "@/server/data/access";
import { createSiteFromPreset } from "@/server/data/sites";
import { getStorage } from "@/server/media/storage";
import { archiveKey } from "@/server/uploaded/intake";
import { beginUploadSession, completeUploadSession, purgeUploads, sessionPrefix, storeUploadPart } from "@/server/uploaded/sessions";
import { checkGithubSource, getSiteSource, listOrganizationSecrets, markSourcePublished, removeGithubToken, setGithubToken, siteGithubToken } from "@/server/uploaded/sources";
import { publishUploadedSite, type UploadJobSummary } from "@/server/uploaded/publish";
import { resolveUploadedPreview } from "@/server/uploaded/serve";
import { sampleUploadedSiteFiles, sampleUploadedSiteZip } from "@/server/demo/uploaded-sample";

/**
 * Large uploads and Publish from GitHub (site-building programme B8, UP-05 to UP-07): a ZIP
 * arrives in parts and is assembled, checked and stored like a one-request upload; abandoned
 * parts and stale checks are purged; a repository is fetched server-side (through a fetch
 * stand-in here), checked and published with its commit remembered on the site; an
 * organization's GitHub token is verified, sealed, usable only through publishing and never
 * readable as a column.
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

const SHA = "0123456789abcdef0123456789abcdef01234567";
const TOKEN = "github_pat_integration_ABCDEFGHIJKLMNOP_9876";

/** A GitHub stand-in: a public repository, a private one that needs the token, and /user for the token. */
function fakeGithub(zipBytes: Uint8Array, privateZip: Uint8Array): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const auth = new Headers(init?.headers).get("authorization");
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    const p = url.pathname;
    if (p === "/user") return auth === `Bearer ${TOKEN}` ? json({ login: "harbor-bot" }) : json({ message: "Bad credentials" }, 401);
    const isPrivate = p.startsWith("/repos/harbor/private-site");
    if (isPrivate && auth !== `Bearer ${TOKEN}`) return json({ message: "Not Found" }, 404);
    const repo = isPrivate ? "harbor/private-site" : "harbor/site";
    if (p === `/repos/${repo}`) return json({ default_branch: "main", private: isPrivate, full_name: repo });
    if (p === `/repos/${repo}/branches/main`) return json({ commit: { sha: SHA, commit: { message: "From GitHub", committer: { date: "2026-09-27T00:00:00Z" } } } });
    if (p === `/repos/${repo}/zipball/${SHA}`) return new Response(new Uint8Array(isPrivate ? privateZip : zipBytes), { status: 200, headers: { "content-type": "application/zip" } });
    return json({ message: "Not Found" }, 404);
  }) as typeof fetch;
}

describe("large uploads (B8)", () => {
  it("takes a ZIP in parts, assembles it, checks it like a one-request upload, stores the archive and drops the parts", async () => {
    const { siteId, ctx } = await uploadedSite("up-parts");
    const zip = sampleUploadedSiteZip();
    const storage = getStorage();
    const result = await withUser(owner, async (db) => {
      const session = await beginUploadSession(db, ctx, owner, { filename: "harbor-lane-studio.zip", size: zip.byteLength });
      expect(session.partBytes).toBe(4096);
      expect(session.parts).toBe(Math.ceil(zip.byteLength / 4096));
      expect(session.parts).toBeGreaterThan(1);
      // The last part is shorter; every other part is exactly partBytes; a wrong size or number is refused.
      await expect(storeUploadPart(db, ctx, owner, session.id, 0, zip.subarray(0, 100))).rejects.toThrow(/should hold 4096 bytes, not 100/);
      await expect(storeUploadPart(db, ctx, owner, session.id, session.parts, zip.subarray(0, 4096))).rejects.toThrow(/outside the upload/);
      await expect(completeUploadSession(db, ctx, owner, session.id)).rejects.toThrow(/incomplete/);
      for (let i = 0; i < session.parts; i++) {
        const part = zip.subarray(i * session.partBytes, Math.min((i + 1) * session.partBytes, zip.byteLength));
        const r = await storeUploadPart(db, ctx, owner, session.id, i, part);
        expect(r.received).toBe(i + 1);
      }
      // Sending a part twice is harmless.
      await storeUploadPart(db, ctx, owner, session.id, 0, zip.subarray(0, 4096));
      expect(await storage.getPrivate(`${sessionPrefix(ctx.site.organizationId, siteId, session.id)}/part-00000`)).not.toBeNull();
      const done = await completeUploadSession(db, ctx, owner, session.id);
      expect(done.ok).toBe(true);
      expect(await storage.getPrivate(`${sessionPrefix(ctx.site.organizationId, siteId, session.id)}/part-00000`)).toBeNull();
      await expect(completeUploadSession(db, ctx, owner, session.id)).rejects.toThrow(/already completed/);
      return { session, done };
    });
    const stored = await getStorage().getPrivate(archiveKey(ctx.site.organizationId, siteId, result.done.jobId));
    expect(stored).not.toBeNull();
    expect(Buffer.from(stored!).equals(Buffer.from(zip))).toBe(true);
    const job = (await admin<{ state: string; filename: string; summary: UploadJobSummary }[]>`select state::text, filename, dry_run_result as summary from public.import_jobs where id = ${result.done.jobId}`)[0]!;
    expect(job.state).toBe("dry_run");
    expect(job.filename).toBe("harbor-lane-studio.zip");
    expect(job.summary.files).toBe(9);
    const session = (await admin<{ state: string; jobId: string; received: number[] }[]>`select state, job_id, received from public.upload_sessions where id = ${result.session.id}`)[0]!;
    expect(session).toMatchObject({ state: "completed", jobId: result.done.jobId });
    expect(session.received).toHaveLength(result.session.parts);
  });

  it("refuses an upload from someone who may not publish the site, and from another person's session", async () => {
    const { siteId, ctx } = await uploadedSite("up-deny");
    const strangerCtx = await withUser(users.publisherB, (db) => loadSiteContext(db, siteId));
    expect(strangerCtx).toBeNull();
    await expect(withUser(users.editorA, async (db) => beginUploadSession(db, (await loadSiteContext(db, siteId))!, users.editorA, { filename: "x.zip", size: 10 }))).rejects.toThrow(/Only owners and publishers/);
    const session = await withUser(owner, (db) => beginUploadSession(db, ctx, owner, { filename: "x.zip", size: 10 }));
    // A publisher of another site of the same organization cannot see this site's session at all.
    await expect(withUser(owner, (db) => storeUploadPart(db, ctx, users.reviewerA, session.id, 0, new Uint8Array(10)))).rejects.toThrow(/another person/);
    await expect(withUser(owner, (db) => beginUploadSession(db, ctx, owner, { filename: "x.zip", size: 65 * 1024 * 1024 }))).rejects.toThrow(/larger than 64 MB/);
  });

  it("purges sessions left open for a day and checks never published in thirty days, with their storage", async () => {
    const { siteId, ctx } = await uploadedSite("up-purge");
    const storage = getStorage();
    const zip = sampleUploadedSiteZip();
    const { session, done } = await withUser(owner, async (db) => {
      const session = await beginUploadSession(db, ctx, owner, { filename: "old.zip", size: 4096 });
      await storeUploadPart(db, ctx, owner, session.id, 0, zip.subarray(0, 4096));
      const fresh = await beginUploadSession(db, ctx, owner, { filename: "fresh.zip", size: zip.byteLength });
      for (let i = 0; i < fresh.parts; i++) await storeUploadPart(db, ctx, owner, fresh.id, i, zip.subarray(i * 4096, Math.min((i + 1) * 4096, zip.byteLength)));
      const done = await completeUploadSession(db, ctx, owner, fresh.id);
      return { session, done };
    });
    await admin`update public.upload_sessions set created_at = now() - interval '2 days' where id = ${session.id}`;
    await admin`update public.import_jobs set created_at = now() - interval '40 days' where id = ${done.jobId}`;
    const partKey = `${sessionPrefix(ctx.site.organizationId, siteId, session.id)}/part-00000`;
    expect(await storage.getPrivate(partKey)).not.toBeNull();
    expect(await storage.getPrivate(archiveKey(ctx.site.organizationId, siteId, done.jobId))).not.toBeNull();
    const purged = await purgeUploads(admin, storage);
    expect(purged.abandonedSessions).toBeGreaterThanOrEqual(1);
    expect(purged.staleChecks).toBeGreaterThanOrEqual(1);
    expect(purged.leftovers).toBe(0);
    expect(await storage.getPrivate(partKey)).toBeNull();
    expect(await storage.getPrivate(archiveKey(ctx.site.organizationId, siteId, done.jobId))).toBeNull();
    expect((await admin<{ state: string }[]>`select state from public.upload_sessions where id = ${session.id}`)[0]!.state).toBe("abandoned");
    expect((await admin<{ state: string }[]>`select state::text from public.import_jobs where id = ${done.jobId}`)[0]!.state).toBe("cancelled");
    await expect(withUser(owner, (db) => completeUploadSession(db, ctx, owner, session.id))).rejects.toThrow(/abandoned/);
  });
});

describe("publish from GitHub (B8)", () => {
  const files = sampleUploadedSiteFiles();
  const withTop = (prefix: string, edit: (name: string, text: string) => string) => zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [`${prefix}/${name}`, strToU8(edit(name, text))])));
  const publicZip = withTop("harbor-site-0123456", (name, text) => (name === "index.html" ? text.replace("Furniture made to be handed down.", "Published from GitHub.") : text));
  const privateZip = withTop("harbor-private-site-0123456", (name, text) => (name === "index.html" ? text.replace("Furniture made to be handed down.", "From the private repository.") : text));
  const fetchImpl = fakeGithub(publicZip, privateZip);
  const github = { fetchImpl, apiUrl: "https://github.example" };

  it("fetches a public repository at its branch head, checks it like a ZIP, remembers the source, publishes with the commit and records what is live", async () => {
    const { siteId, siteKey, ctx } = await uploadedSite("gh-public");
    const check = await withUser(owner, (db) => checkGithubSource(db, ctx, owner, { repository: "https://github.com/harbor/site" }, github));
    expect(check).toMatchObject({ ok: true, repository: "harbor/site", branch: "main", root: null, commit: SHA, isPrivate: false });
    const job = (await admin<{ state: string; filename: string; summary: UploadJobSummary }[]>`select state::text, filename, dry_run_result as summary from public.import_jobs where id = ${check.jobId}`)[0]!;
    expect(job.state).toBe("dry_run");
    expect(job.filename).toBe("harbor-site-0123456.zip");
    expect(job.summary.github).toEqual({ repository: "harbor/site", branch: "main", commit: SHA, root: null });
    expect(job.summary.strippedFolder).toBe("harbor-site-0123456");
    expect(job.summary.files).toBe(9);
    const source = (await withUser(owner, (db) => getSiteSource(db, siteId)))!;
    expect(source).toMatchObject({ kind: "github", repository: "harbor/site", branch: "main", root: null, lastCommit: SHA, lastPublishedCommit: null });
    // Publishing the check the way the action does: the stored archive, the remembered root and source.
    const bytes = (await getStorage().getPrivate(archiveKey(ctx.site.organizationId, siteId, check.jobId)))!;
    const published = await publishUploadedSite(owner, ctx.site, bytes, { filename: job.filename, reason: "from github", idempotencyKey: key(), root: job.summary.root, github: job.summary.github });
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    await withUser(owner, (db) => markSourcePublished(db, siteId, job.summary.github!, published.release.releaseId));
    const after = (await withUser(owner, (db) => getSiteSource(db, siteId)))!;
    expect(after.lastPublishedCommit).toBe(SHA);
    expect(after.lastPublishedReleaseId).toBe(published.release.releaseId);
    const release = (await resolveUploadedPreview(siteKey))!;
    expect(release.snapshot.source.github).toEqual({ repository: "harbor/site", branch: "main", commit: SHA, root: null });
    const home = unzipSync(publicZip)["harbor-site-0123456/index.html"]!;
    expect(Buffer.from(home).toString("utf8")).toContain("Published from GitHub.");
    expect(release.snapshot.files["/index.html"]!.bytes).toBe(home.byteLength);
    // Checking again with a folder that does not exist is a clear refusal on the job, not an exception.
    const bad = await withUser(owner, (db) => checkGithubSource(db, ctx, owner, { repository: "harbor/site", root: "dist" }, github));
    expect(bad.ok).toBe(false);
    expect(bad.errors).toEqual(['No index.html in the folder "dist" of the ZIP.']);
  });

  it("needs the organization's token for a private repository: owners store it after GitHub accepts it, publishers use it, nobody reads it back", async () => {
    const { siteId, ctx } = await uploadedSite("gh-private");
    await expect(withUser(owner, (db) => checkGithubSource(db, ctx, owner, { repository: "harbor/private-site" }, github))).rejects.toThrow(/private and no token with access/);
    // Not an owner of the organization: refused in SQL.
    await expect(withUser(users.editorA, (db) => setGithubToken(db, organizations.pineHollow, TOKEN, github))).rejects.toThrow(/only organization owners manage tokens/);
    await expect(withUser(owner, (db) => setGithubToken(db, organizations.pineHollow, "not-a-token", github))).rejects.toThrow(/did not accept the token|Paste the whole token/);
    const stored = await withUser(owner, (db) => setGithubToken(db, organizations.pineHollow, TOKEN, github));
    expect(stored).toEqual({ login: "harbor-bot", last4: "9876" });
    const meta = await withUser(owner, (db) => listOrganizationSecrets(db, [organizations.pineHollow]));
    expect(meta.map((m) => ({ kind: m.kind, last4: m.last4 }))).toEqual([{ kind: "github_token", last4: "9876" }]);
    // The ciphertext column is not granted to the application role; the sealed value is not the token.
    await expect(withUser(owner, (db) => db`select ciphertext from public.organization_secrets where organization_id = ${organizations.pineHollow}`)).rejects.toThrow(/permission denied/);
    const sealed = (await admin<{ ciphertext: string }[]>`select ciphertext from public.organization_secrets where organization_id = ${organizations.pineHollow} and kind = 'github_token'`)[0]!.ciphertext;
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain(TOKEN);
    expect(await withUser(owner, (db) => siteGithubToken(db, siteId))).toBe(TOKEN);
    // A member without publish rights on the site gets nothing; a stranger gets nothing.
    expect(await withUser(users.editorA, (db) => siteGithubToken(db, siteId))).toBeNull();
    expect(await withUser(users.stranger, (db) => siteGithubToken(db, siteId))).toBeNull();
    const check = await withUser(owner, (db) => checkGithubSource(db, ctx, owner, { repository: "harbor/private-site" }, github));
    expect(check).toMatchObject({ ok: true, repository: "harbor/private-site", isPrivate: true, commit: SHA });
    const audit = await admin<{ action: string; metadata: Record<string, unknown> }[]>`select action, metadata from public.audit_events where organization_id = ${organizations.pineHollow} and action like 'organization.secret_%' order by created_at desc limit 1`;
    expect(audit[0]).toMatchObject({ action: "organization.secret_set", metadata: { kind: "github_token", last4: "9876" } });
    expect(await withUser(owner, (db) => removeGithubToken(db, organizations.pineHollow))).toBe(true);
    expect(await withUser(owner, (db) => removeGithubToken(db, organizations.pineHollow))).toBe(false);
    expect(await withUser(owner, (db) => siteGithubToken(db, siteId))).toBeNull();
    await expect(withUser(owner, (db) => checkGithubSource(db, ctx, owner, { repository: "harbor/private-site" }, github))).rejects.toThrow(/private and no token/);
  });
});

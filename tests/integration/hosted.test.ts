import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { seedInfo, adminClient, withUser, withAnon, endPool } from "./helpers";
import { createSupabaseAuthProvider, hashSessionToken } from "@/server/auth/supabase-provider";
import type { GoTrueClient } from "@/server/auth/gotrue";
import { resetConfigForTests } from "@/server/config";

const seed = seedInfo();
let admin: Sql;

beforeAll(() => {
  admin = adminClient();
});
afterAll(async () => {
  await admin.end();
  await endPool();
});

describe("hosted authentication: platform sessions issued after GoTrue verification", () => {
  const ownerEmail = "owner@lernerworks.example";
  const fakeGotrue = {
    async signInWithPassword(email: string, password: string) {
      if (email === ownerEmail && password === "correct") {
        return { ok: true as const, session: { accessToken: "at", refreshToken: "rt", expiresIn: 3600, user: { id: seed.users.owner, email: ownerEmail } } };
      }
      return { ok: false as const, reason: "invalid_credentials" as const, status: 400 };
    },
  } as unknown as GoTrueClient;
  const provider = createSupabaseAuthProvider(fakeGotrue);

  it("signs in, resolves and revokes an opaque session stored only as a hash", async () => {
    const wrong = await provider.signInWithPassword(ownerEmail, "wrong");
    expect(wrong).toEqual({ ok: false, reason: "invalid_credentials" });
    const result = await provider.signInWithPassword(ownerEmail, "correct");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cookie.name).toBe("lw_session");
    expect(result.cookie.value).toMatch(/^[0-9a-f]{64}$/);
    expect(result.cookie.expires.getTime()).toBeGreaterThan(Date.now() + 13 * 24 * 3600 * 1000);
    const stored = await admin`select user_id, token_hash from public.app_sessions where token_hash = ${hashSessionToken(result.cookie.value)}`;
    expect(stored).toHaveLength(1);
    expect(stored[0]!.userId).toBe(seed.users.owner);
    expect(stored[0]!.tokenHash).not.toBe(result.cookie.value);

    const user = await provider.resolveSession(result.cookie.value);
    expect(user).toMatchObject({ id: seed.users.owner, email: ownerEmail });
    expect(await provider.resolveSession("0".repeat(64))).toBeNull();
    expect(await provider.resolveSession("not-a-token")).toBeNull();

    await provider.signOut(result.cookie.value);
    expect(await provider.resolveSession(result.cookie.value)).toBeNull();
  });

  it("keeps the session table out of reach of the PostgREST roles", async () => {
    await expect(withAnon((db) => db`select count(*) from public.app_sessions`)).rejects.toMatchObject({ code: "42501" });
    await expect(withUser(seed.users.owner, (db) => db`select count(*) from public.app_sessions`)).rejects.toMatchObject({ code: "42501" });
    await expect(withAnon((db) => db`select private.resolve_app_session(${"0".repeat(64)})`)).rejects.toMatchObject({ code: "42501" });
  });

  it("rejects sessions for unknown users", async () => {
    const orphan = createSupabaseAuthProvider({
      async signInWithPassword() {
        return { ok: true, session: { accessToken: "a", refreshToken: "r", expiresIn: 1, user: { id: "00000000-0000-4000-8000-000000000000", email: "ghost@example.test" } } };
      },
    } as unknown as GoTrueClient);
    await expect(orphan.signInWithPassword("ghost@example.test", "x")).rejects.toMatchObject({ code: "P0002" });
  });
});

describe("domain workflow and go-live control", () => {
  const owner = seed.users.owner;
  const site = seed.sites.rangeAthletics;
  const host = `launch-${Date.now().toString(36)}.range.example`;
  let domainId = "";

  afterAll(async () => {
    await admin`update public.sites set mode = 'demo' where id = ${site}`;
    await admin`delete from public.domains where normalized_host like 'launch-%.range.example'`;
  });

  it("registers a domain as pending and refuses activation until the provider verified it", async () => {
    domainId = (await withUser(owner, (db) => db<{ id: string }[]>`
      insert into public.domains (organization_id, site_id, normalized_host, is_canonical, created_by)
      select organization_id, id, ${host}, false, ${owner} from public.sites where id = ${site} returning id`))[0]!.id;
    await expect(withUser(owner, (db) => db`select public.activate_domain(${domainId})`)).rejects.toMatchObject({ code: "P0001" });
    await expect(withUser(seed.users.editorA, (db) => db`select public.activate_domain(${domainId})`)).rejects.toMatchObject({ code: "42501" });
    // A direct update of the canonical flag is no longer possible; only the function may change it.
    await expect(withUser(owner, (db) => db`update public.domains set is_canonical = true where id = ${domainId}`)).rejects.toMatchObject({ code: "42501" });
  });

  it("records provider facts, activates, requires a canonical verified domain to go live, and serves the live release", async () => {
    const facts = { provider: "vercel", registered: true, verified: false, configured: false, verification: [{ type: "TXT", name: `_vercel.${host}`, value: "vc-domain-verify=x" }], recommended: [], checkedAt: new Date().toISOString() };
    await withUser(owner, (db) => db`select public.set_domain_verification(${domainId}, false, ${db.json(facts as never)})`);
    let row = (await admin`select status::text, verified_at, verification_instructions from public.domains where id = ${domainId}`)[0]!;
    expect(row.status).toBe("verifying");
    expect(row.verifiedAt).toBeNull();
    expect(row.verificationInstructions.verification[0].type).toBe("TXT");
    await expect(withUser(owner, (db) => db`select public.activate_domain(${domainId})`)).rejects.toMatchObject({ code: "P0001" });

    await withUser(owner, (db) => db`select public.set_domain_verification(${domainId}, true, ${db.json({ ...facts, verified: true, configured: true } as never)})`);
    row = (await admin`select status::text, verified_at from public.domains where id = ${domainId}`)[0]!;
    expect(row.status).toBe("verifying");
    expect(row.verifiedAt).not.toBeNull();
    await withUser(owner, (db) => db`select public.activate_domain(${domainId})`);
    expect((await admin`select status::text from public.domains where id = ${domainId}`)[0]!.status).toBe("active");

    // Live mode needs a canonical domain; the active one is not canonical yet.
    await expect(withUser(owner, (db) => db`select public.set_site_mode(${site}, 'live')`)).rejects.toMatchObject({ code: "P0001" });
    await withUser(owner, (db) => db`select public.set_canonical_domain(${domainId})`);
    await withUser(owner, (db) => db`select public.set_site_mode(${site}, 'live')`);
    expect((await admin`select mode::text from public.sites where id = ${site}`)[0]!.mode).toBe("live");
    const live = await withAnon((db) => db<{ siteId: string; isCanonical: boolean; canonicalHost: string }[]>`select site_id, is_canonical, canonical_host from public.get_live_release(${host})`);
    expect(live[0]).toMatchObject({ siteId: site, isCanonical: true, canonicalHost: host });
    expect(await withAnon((db) => db`select release_id from public.get_demo_release('range-athletics')`)).toHaveLength(0);

    // The canonical domain of a live site cannot be disabled; leaving live mode restores the demo route.
    await expect(withUser(owner, (db) => db`select public.disable_domain(${domainId})`)).rejects.toMatchObject({ code: "P0001" });
    await expect(withUser(seed.users.editorA, (db) => db`select public.set_site_mode(${site}, 'demo')`)).rejects.toMatchObject({ code: "42501" });
    await withUser(owner, (db) => db`select public.set_site_mode(${site}, 'demo')`);
    expect(await withAnon((db) => db`select release_id from public.get_live_release(${host})`)).toHaveLength(0);
    expect(await withAnon((db) => db`select release_id from public.get_demo_release('range-athletics')`)).toHaveLength(1);
    await withUser(owner, (db) => db`select public.disable_domain(${domainId})`);
    await expect(withUser(owner, (db) => db`select public.set_canonical_domain(${domainId})`)).rejects.toMatchObject({ code: "P0001" });
    await withUser(owner, (db) => db`select public.remove_domain(${domainId})`);
    expect(await admin`select id from public.domains where id = ${domainId}`).toHaveLength(0);
    const audit = await admin`select action from public.audit_events where entity_id = ${domainId} order by created_at`;
    expect(audit.map((a) => a.action)).toEqual(["domain.verification_checked", "domain.verification_checked", "domain.activated", "domain.canonical_set", "domain.disabled", "domain.removed"]);
  });
});

describe("scheduled job endpoints", () => {
  const saved = { ...process.env };
  afterAll(() => {
    process.env = { ...saved };
    resetConfigForTests();
  });

  it("require the bearer secret and run one bounded batch with the configured provider", async () => {
    process.env.JOB_TRIGGER_SECRET = "s".repeat(40);
    resetConfigForTests();
    const deliver = await import("@/app/api/jobs/deliver/route");
    const retention = await import("@/app/api/jobs/retention/route");
    const url = "http://localhost:3100/api/jobs/deliver";
    expect((await deliver.GET(new Request(url))).status).toBe(401);
    expect((await deliver.GET(new Request(url, { headers: { Authorization: "Bearer wrong" } }))).status).toBe(401);
    const ok = await deliver.GET(new Request(url, { headers: { Authorization: `Bearer ${"s".repeat(40)}` } }));
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { ok: boolean; job: string; provider: string; claimed: number };
    expect(body).toMatchObject({ ok: true, job: "deliver", provider: "local-sink" });
    expect(body.claimed).toBeGreaterThanOrEqual(0);
    const kept = await retention.POST(new Request("http://localhost:3100/api/jobs/retention", { method: "POST", headers: { Authorization: `Bearer ${"s".repeat(40)}` } }));
    expect(kept.status).toBe(200);
    expect(await kept.json()).toMatchObject({ ok: true, job: "retention", inquiryRetentionDays: 90 });
  });

  it("answer 503 when no secret is configured, so a misconfigured scheduler is visible", async () => {
    delete process.env.JOB_TRIGGER_SECRET;
    delete process.env.CRON_SECRET;
    resetConfigForTests();
    const deliver = await import("@/app/api/jobs/deliver/route");
    expect((await deliver.GET(new Request("http://localhost:3100/api/jobs/deliver", { headers: { Authorization: "Bearer anything" } }))).status).toBe(503);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GoTrueClient } from "@/server/auth/gotrue";
import { SupabaseStorage } from "@/server/media/supabase-storage";
import { VercelDomainProvider } from "@/server/domains/vercel";
import { readyToActivate } from "@/server/domains/provider";
import { ResendProvider } from "@/server/inquiries/notify";
import { authorizeJobRequest } from "@/server/jobs/auth";
import { getConfig, resetConfigForTests } from "@/server/config";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

/** A scripted fetch: each call pops the next response; every request is recorded. */
function fakeFetch(responses: Array<{ status: number; body?: unknown; text?: string }>) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k.toLowerCase()] = v));
    const body = init?.body == null ? null : typeof init.body === "string" ? init.body : `<${(init.body as Uint8Array).byteLength} bytes>`;
    calls.push({ url, method: init?.method ?? "GET", headers, body });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request ${init?.method ?? "GET"} ${url}`);
    if (next.text !== undefined) return new Response(next.text, { status: next.status });
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), { status: next.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { impl, calls };
}

describe("GoTrue client", () => {
  const session = { access_token: "at", refresh_token: "rt", expires_in: 3600, user: { id: "11111111-1111-4111-8111-111111111111", email: "Owner@Example.test" } };

  it("signs in with the password grant using the anon key and lowercases the email", async () => {
    const f = fakeFetch([{ status: 200, body: session }]);
    const c = new GoTrueClient("https://proj.supabase.co", "anon-key", "service-key", f.impl);
    const r = await c.signInWithPassword("owner@example.test", "pw");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.session.user).toEqual({ id: session.user.id, email: "owner@example.test" });
    expect(f.calls[0]!.url).toBe("https://proj.supabase.co/auth/v1/token?grant_type=password");
    expect(f.calls[0]!.headers.apikey).toBe("anon-key");
    expect(f.calls[0]!.headers.authorization).toBe("Bearer anon-key");
    expect(JSON.parse(f.calls[0]!.body!)).toEqual({ email: "owner@example.test", password: "pw" });
  });

  it("maps 400 to invalid credentials, 503 and network failures to unavailable", async () => {
    const f = fakeFetch([{ status: 400, body: { error_code: "invalid_credentials", msg: "Invalid login credentials" } }, { status: 503, body: {} }]);
    const c = new GoTrueClient("https://proj.supabase.co", "anon", undefined, f.impl);
    expect(await c.signInWithPassword("a@b.c", "x")).toEqual({ ok: false, reason: "invalid_credentials", status: 400 });
    expect(await c.signInWithPassword("a@b.c", "x")).toEqual({ ok: false, reason: "unavailable", status: 503 });
    const down = new GoTrueClient("https://proj.supabase.co", "anon", undefined, (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch);
    expect(await down.signInWithPassword("a@b.c", "x")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("creates confirmed users with the service role and reports existing accounts", async () => {
    const f = fakeFetch([{ status: 200, body: { id: "22222222-2222-4222-8222-222222222222", email: "new@example.test" } }, { status: 422, body: { code: 422, error_code: "email_exists", msg: "A user with this email address has already been registered" } }]);
    const c = new GoTrueClient("https://proj.supabase.co", "anon", "service", f.impl);
    const created = await c.adminCreateUser("new@example.test", "long-enough-password");
    expect(created).toEqual({ ok: true, user: { id: "22222222-2222-4222-8222-222222222222", email: "new@example.test" } });
    expect(f.calls[0]!.url).toBe("https://proj.supabase.co/auth/v1/admin/users");
    expect(f.calls[0]!.headers.authorization).toBe("Bearer service");
    expect(JSON.parse(f.calls[0]!.body!)).toEqual({ email: "new@example.test", password: "long-enough-password", email_confirm: true });
    expect(await c.adminCreateUser("new@example.test", "long-enough-password")).toMatchObject({ ok: false, reason: "exists" });
    const noKey = new GoTrueClient("https://proj.supabase.co", "anon", undefined, f.impl);
    await expect(noKey.adminCreateUser("x@y.z", "long-enough-password")).rejects.toThrow(/SERVICE_ROLE/);
  });

  it("runs the PKCE recovery flow: challenge on request, verifier on exchange, bearer on password update", async () => {
    const f = fakeFetch([{ status: 200, body: {} }, { status: 200, body: session }, { status: 200, body: { id: session.user.id } }]);
    const c = new GoTrueClient("https://proj.supabase.co/", "anon", undefined, f.impl);
    expect(await c.requestPasswordRecovery("owner@example.test", "https://app.example/auth/recovery", "CHALLENGE")).toEqual({ ok: true });
    expect(f.calls[0]!.url).toBe("https://proj.supabase.co/auth/v1/recover?redirect_to=https%3A%2F%2Fapp.example%2Fauth%2Frecovery");
    expect(JSON.parse(f.calls[0]!.body!)).toEqual({ email: "owner@example.test", code_challenge: "CHALLENGE", code_challenge_method: "s256" });
    const ex = await c.exchangeCodeForSession("CODE", "VERIFIER");
    expect(ex.ok).toBe(true);
    expect(f.calls[1]!.url).toBe("https://proj.supabase.co/auth/v1/token?grant_type=pkce");
    expect(JSON.parse(f.calls[1]!.body!)).toEqual({ auth_code: "CODE", code_verifier: "VERIFIER" });
    expect(await c.updatePassword("at", "new-password-123")).toEqual({ ok: true });
    expect(f.calls[2]!.method).toBe("PUT");
    expect(f.calls[2]!.headers.authorization).toBe("Bearer at");
  });

  it("reads public settings for the launch check", async () => {
    const f = fakeFetch([{ status: 200, body: { disable_signup: true, external: { email: true } } }]);
    const c = new GoTrueClient("https://proj.supabase.co", "anon", undefined, f.impl);
    expect(await c.settings()).toEqual({ ok: true, disableSignup: true, externalEmail: true });
  });
});

describe("Supabase storage", () => {
  const buckets = { private: "private", public: "public-assets" };

  it("uploads private objects with upsert and reads them back through the authenticated endpoint", async () => {
    const f = fakeFetch([{ status: 200, body: { Key: "private/org/site/asset/w480.webp" } }, { status: 200, text: "bytes" }, { status: 400, body: { statusCode: "404", error: "not_found", message: "Object not found" } }]);
    const s = new SupabaseStorage("https://proj.supabase.co", "service", buckets, f.impl);
    await s.putPrivate("org/site/asset/w480.webp", new Uint8Array([1, 2, 3]), "image/webp");
    expect(f.calls[0]!.url).toBe("https://proj.supabase.co/storage/v1/object/private/org/site/asset/w480.webp");
    expect(f.calls[0]!.headers["x-upsert"]).toBe("true");
    expect(f.calls[0]!.headers.authorization).toBe("Bearer service");
    expect(f.calls[0]!.headers["content-type"]).toBe("image/webp");
    expect(new TextDecoder().decode((await s.getPrivate("org/site/asset/w480.webp"))!)).toBe("bytes");
    expect(f.calls[1]!.url).toBe("https://proj.supabase.co/storage/v1/object/authenticated/private/org/site/asset/w480.webp");
    expect(await s.getPrivate("org/site/missing.webp")).toBeNull();
  });

  it("treats an existing public object as success and builds public URLs on the bucket", async () => {
    const f = fakeFetch([{ status: 409, body: { statusCode: "409", error: "Duplicate", message: "The resource already exists" } }, { status: 200, text: "" }, { status: 404, text: "" }]);
    const s = new SupabaseStorage("https://proj.supabase.co", "service", buckets, f.impl);
    const name = `${"a".repeat(64)}-w480.webp`;
    await expect(s.putPublic(name, new Uint8Array([1]), "image/webp")).resolves.toBeUndefined();
    expect(f.calls[0]!.headers["x-upsert"]).toBe("false");
    expect(f.calls[0]!.headers["cache-control"]).toBe("max-age=31536000");
    expect(s.publicUrl(name)).toBe(`https://proj.supabase.co/storage/v1/object/public/public-assets/${name}`);
    expect(await s.existsPublic(name)).toBe(true);
    expect(f.calls[1]!.method).toBe("HEAD");
    expect(await s.existsPublic(name)).toBe(false);
  });

  it("deletes a prefix by walking folders and removing the collected paths", async () => {
    const f = fakeFetch([
      { status: 200, body: [{ name: "asset-1", id: null }, { name: "note.txt", id: "x" }] },
      { status: 200, body: [{ name: "w480.webp", id: "y" }, { name: "original.png", id: "z" }] },
      { status: 200, body: [] },
    ]);
    const s = new SupabaseStorage("https://proj.supabase.co", "service", buckets, f.impl);
    await s.deletePrivatePrefix("org/site");
    expect(f.calls[0]!.url).toBe("https://proj.supabase.co/storage/v1/object/list/private");
    expect(JSON.parse(f.calls[0]!.body!).prefix).toBe("org/site");
    expect(JSON.parse(f.calls[1]!.body!).prefix).toBe("org/site/asset-1");
    expect(f.calls[2]!.method).toBe("DELETE");
    expect(JSON.parse(f.calls[2]!.body!)).toEqual({ prefixes: ["org/site/asset-1/w480.webp", "org/site/asset-1/original.png", "org/site/note.txt"] });
  });

  it("rejects unsafe keys before any request", async () => {
    const f = fakeFetch([]);
    const s = new SupabaseStorage("https://proj.supabase.co", "service", buckets, f.impl);
    await expect(s.getPrivate("../etc/passwd")).rejects.toThrow(/unsafe/);
    expect(f.calls).toHaveLength(0);
  });
});

describe("Vercel domain provider", () => {
  it("registers a domain and composes provider facts from the project domain and its DNS configuration", async () => {
    const f = fakeFetch([
      { status: 200, body: { name: "www.range.example", verified: false, verification: [{ type: "TXT", domain: "_vercel.range.example", value: "vc-domain-verify=abc", reason: "pending_domain_verification" }] } },
      { status: 200, body: { configuredBy: null, misconfigured: true, recommendedCNAME: [{ rank: 1, value: "cname.vercel-dns.com." }] } },
    ]);
    const p = new VercelDomainProvider("token", "prj_123", "team_1", f.impl);
    const status = await p.register("www.range.example");
    expect(f.calls[0]!.url).toBe("https://api.vercel.com/v10/projects/prj_123/domains?teamId=team_1");
    expect(f.calls[0]!.method).toBe("POST");
    expect(JSON.parse(f.calls[0]!.body!)).toEqual({ name: "www.range.example" });
    expect(f.calls[0]!.headers.authorization).toBe("Bearer token");
    expect(f.calls[1]!.url).toBe("https://api.vercel.com/v6/domains/www.range.example/config?teamId=team_1");
    expect(status).toMatchObject({ provider: "vercel", registered: true, verified: false, configured: false, configuredBy: null });
    expect(status.verification).toEqual([{ type: "TXT", name: "_vercel.range.example", value: "vc-domain-verify=abc", reason: "pending_domain_verification" }]);
    expect(status.recommended).toEqual([{ type: "CNAME", name: "www.range.example", value: "cname.vercel-dns.com." }]);
    expect(readyToActivate(status)).toBe(false);
  });

  it("asks the provider to re-verify pending domains and reports readiness when verified and configured", async () => {
    const f = fakeFetch([
      { status: 200, body: { name: "range.example", verified: false, verification: [] } },
      { status: 200, body: { name: "range.example", verified: true, verification: [] } },
      { status: 200, body: { configuredBy: "A", misconfigured: false, recommendedIPv4: [{ rank: 1, value: ["203.0.113.10"] }] } },
    ]);
    const p = new VercelDomainProvider("token", "prj_123", undefined, f.impl);
    const status = await p.status("range.example");
    expect(f.calls[0]!.url).toBe("https://api.vercel.com/v9/projects/prj_123/domains/range.example");
    expect(f.calls[1]!.url).toBe("https://api.vercel.com/v9/projects/prj_123/domains/range.example/verify");
    expect(status).toMatchObject({ registered: true, verified: true, configured: true, configuredBy: "A" });
    expect(status.recommended).toEqual([{ type: "A", name: "range.example", value: "203.0.113.10" }]);
    expect(readyToActivate(status)).toBe(true);
  });

  it("reports unregistered hostnames and surfaces provider refusals with their message", async () => {
    const f = fakeFetch([{ status: 404, body: { error: { code: "not_found", message: "Domain not found" } } }, { status: 403, body: { error: { code: "forbidden", message: "You don't have access to this domain" } } }]);
    const p = new VercelDomainProvider("token", "prj_123", undefined, f.impl);
    expect(await p.status("nobody.example")).toMatchObject({ registered: false, verified: false, configured: null });
    await expect(p.register("taken.example")).rejects.toThrow(/refused taken\.example: You don't have access to this domain \(forbidden\)/);
  });
});

describe("Resend provider", () => {
  it("sends with an idempotency key and distinguishes transient from permanent failures", async () => {
    const f = fakeFetch([{ status: 200, body: { id: "email_1" } }, { status: 500, body: {} }, { status: 422, body: { message: "invalid from" } }]);
    const p = new ResendProvider("re_key", "Lerner Works <notifications@agency.example>", f.impl);
    const message = { to: ["a@b.example"], subject: "s", text: "t", idempotencyKey: "inquiry-1" };
    expect(await p.send(message)).toMatchObject({ ok: true, reference: "email_1", accepted: true });
    expect(f.calls[0]!.headers["idempotency-key"]).toBe("inquiry-1");
    expect(f.calls[0]!.headers.authorization).toBe("Bearer re_key");
    expect(await p.send(message)).toMatchObject({ ok: false, transient: true });
    expect(await p.send(message)).toMatchObject({ ok: false, transient: false });
  });
});

describe("configuration and job authorization", () => {
  const saved = { ...process.env };
  beforeEach(() => resetConfigForTests());
  afterEach(() => {
    process.env = { ...saved };
    resetConfigForTests();
  });

  const hostedEnv = {
    APP_ENV: "staging",
    APP_URL: "https://staging.example",
    APP_HOST: "staging.example",
    DATABASE_URL: "postgres://lw_app.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    DATABASE_ADMIN_URL: "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
    SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    AUTH_PROVIDER: "supabase",
    STORAGE_PROVIDER: "supabase",
    NOTIFY_PROVIDER: "resend",
    NOTIFY_RESEND_API_KEY: "re_x",
    SUPABASE_URL: "https://ref.supabase.co",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    JOB_TRIGGER_SECRET: "j".repeat(40),
  };

  it("accepts a complete hosted configuration and rejects an incomplete one with every problem named", () => {
    process.env = { ...saved, ...hostedEnv };
    expect(getConfig()).toMatchObject({ isLocal: false, AUTH_PROVIDER: "supabase", jobTriggerSecret: "j".repeat(40) });
    resetConfigForTests();
    process.env = { ...saved, ...hostedEnv, APP_URL: "http://staging.example", STORAGE_PROVIDER: "local", NOTIFY_PROVIDER: "local-sink", JOB_TRIGGER_SECRET: "", CRON_SECRET: "" };
    expect(() => getConfig()).toThrow(/APP_URL must use https.*STORAGE_PROVIDER must be supabase.*NOTIFY_PROVIDER must be resend.*JOB_TRIGGER_SECRET/s);
  });

  it("refuses the local auth provider outside a local environment", () => {
    process.env = { ...saved, ...hostedEnv, AUTH_PROVIDER: "local" };
    expect(() => getConfig()).toThrow(/development-only/);
  });

  it("authorizes job requests only with the exact bearer secret", () => {
    process.env = { ...saved, ...hostedEnv, JOB_TRIGGER_SECRET: undefined, CRON_SECRET: "c".repeat(40) };
    const req = (auth?: string) => new Request("https://staging.example/api/jobs/deliver", { headers: auth ? { Authorization: auth } : {} });
    expect(authorizeJobRequest(req())?.status).toBe(401);
    expect(authorizeJobRequest(req("Bearer nope"))?.status).toBe(401);
    expect(authorizeJobRequest(req(`Bearer ${"c".repeat(39)}x`))?.status).toBe(401);
    expect(authorizeJobRequest(req(`Bearer ${"c".repeat(40)}`))).toBeNull();
    resetConfigForTests();
    process.env = { ...saved, APP_ENV: "local", DATABASE_URL: "postgres://lw_app:pw@127.0.0.1:5432/lernerworks_dev", SESSION_SECRET: "0123456789abcdef0123456789abcdef", JOB_TRIGGER_SECRET: undefined, CRON_SECRET: undefined };
    expect(authorizeJobRequest(req("Bearer anything"))?.status).toBe(503);
  });
});

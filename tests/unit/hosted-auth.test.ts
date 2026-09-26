import { describe, expect, it } from "vitest";
import { buildAuthPatch, parseHostedAuthArgs as parseArgs, readAuthConfig, redactAuthPatch, RESEND_SMTP, summarizeAuthConfig, updateAuthConfig, verifyAuthPatch } from "../../scripts/lib/supabase-auth";

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
    calls.push({ url, method: init?.method ?? "GET", headers, body: typeof init?.body === "string" ? init.body : null });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request ${init?.method ?? "GET"} ${url}`);
    if (next.text !== undefined) return new Response(next.text, { status: next.status });
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { impl, calls };
}

const REF = "abcdefghijabcdefghij";
const URL_ = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
const smtp = { ...RESEND_SMTP, pass: "re_secret_key", adminEmail: "notifications@example.test", senderName: " Example Platform " };

describe("Supabase Auth settings through the Management API", () => {
  it("builds a change set with only the requested fields, using the documented field names", () => {
    expect(buildAuthPatch({ disableSignup: true })).toEqual({ disable_signup: true });
    expect(buildAuthPatch({ siteUrl: "https://app.example.test", redirectUrls: ["https://app.example.test/auth/recovery", "https://app.example.test/"] })).toEqual({
      site_url: "https://app.example.test",
      uri_allow_list: "https://app.example.test/auth/recovery,https://app.example.test/",
    });
    expect(buildAuthPatch({ smtp, rateLimitEmailSent: 30 })).toEqual({
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: "re_secret_key",
      smtp_admin_email: "notifications@example.test",
      smtp_sender_name: "Example Platform",
      rate_limit_email_sent: 30,
    });
  });

  it("rejects values the provider would refuse or that would misconfigure the project", () => {
    expect(() => buildAuthPatch({})).toThrow(/nothing to change/);
    expect(() => buildAuthPatch({ siteUrl: "http://app.example.test" })).toThrow(/https/);
    expect(() => buildAuthPatch({ siteUrl: "https://a.example.test,https://b.example.test" })).toThrow(/commas/);
    expect(() => buildAuthPatch({ redirectUrls: [] })).toThrow(/at least one/);
    expect(() => buildAuthPatch({ redirectUrls: ["not a url"] })).toThrow(/https/);
    expect(() => buildAuthPatch({ smtp: { ...smtp, pass: "" } })).toThrow(/password/);
    expect(() => buildAuthPatch({ smtp: { ...smtp, adminEmail: "not-an-address" } })).toThrow(/sender address/);
    expect(() => buildAuthPatch({ smtp: { ...smtp, senderName: "  " } })).toThrow(/sender name/);
    expect(() => buildAuthPatch({ rateLimitEmailSent: 0 })).toThrow(/positive integer/);
    expect(() => buildAuthPatch({ rateLimitEmailSent: 2.5 })).toThrow(/positive integer/);
  });

  it("redacts the SMTP password and never lists it in summaries", () => {
    const patch = buildAuthPatch({ smtp });
    expect(redactAuthPatch(patch).smtp_pass).toBe("***");
    expect(redactAuthPatch(patch).smtp_host).toBe("smtp.resend.com");
    expect(redactAuthPatch({ disable_signup: true })).toEqual({ disable_signup: true });
    const lines = summarizeAuthConfig({ smtp_host: "smtp.resend.com", smtp_port: "465", smtp_user: "resend", smtp_admin_email: "notifications@example.test", smtp_sender_name: "Example", rate_limit_email_sent: 30, smtp_max_frequency: 60 });
    expect(lines.join("\n")).toContain("custom SMTP smtp.resend.com:465 as notifications@example.test (Example)");
    expect(lines.join("\n")).not.toContain("re_secret_key");
    expect(summarizeAuthConfig({}).join("\n")).toContain("default Supabase mailer");
  });

  it("reads, patches and reads back with the personal access token, keeping only the managed fields", async () => {
    const reported = { site_url: "https://app.example.test", uri_allow_list: "https://app.example.test/auth/recovery", disable_signup: true, smtp_host: "smtp.resend.com", smtp_port: "465", smtp_user: "resend", smtp_pass: "should-not-leak", smtp_admin_email: "notifications@example.test", smtp_sender_name: "Example Platform", rate_limit_email_sent: 30, jwt_exp: 3600 };
    const f = fakeFetch([{ status: 200, body: reported }, { status: 200, body: reported }, { status: 200, body: reported }]);
    const before = await readAuthConfig(REF, "sbp_token", f.impl);
    expect(before).not.toHaveProperty("smtp_pass");
    expect(before).not.toHaveProperty("jwt_exp");
    expect(before.disable_signup).toBe(true);

    const patch = buildAuthPatch({ smtp, rateLimitEmailSent: 30 });
    const after = await updateAuthConfig(REF, "sbp_token", patch, f.impl);
    expect(f.calls.map((c) => c.method)).toEqual(["GET", "PATCH", "GET"]);
    expect(f.calls.every((c) => c.url === URL_)).toBe(true);
    expect(f.calls.every((c) => c.headers.authorization === "Bearer sbp_token")).toBe(true);
    expect(JSON.parse(f.calls[1]!.body!)).toEqual(patch);
    expect(verifyAuthPatch(patch, after)).toEqual([]);
  });

  it("reports values the provider does not echo back and maps API errors", async () => {
    const patch = buildAuthPatch({ siteUrl: "https://app.example.test", disableSignup: true, smtp });
    expect(verifyAuthPatch(patch, { site_url: "https://app.example.test", disable_signup: false, smtp_host: "smtp.resend.com", smtp_port: "465", smtp_user: "resend", smtp_admin_email: "notifications@example.test", smtp_sender_name: "Example Platform" })).toEqual([
      'disable_signup: expected true, provider reports false',
    ]);
    const f = fakeFetch([{ status: 401, body: { message: "Unauthorized" } }, { status: 400, body: { message: ["smtp_port must be a string"] } }, { status: 502, text: "Bad Gateway" }]);
    await expect(readAuthConfig(REF, "bad", f.impl)).rejects.toThrow("Auth settings request failed (401): Unauthorized");
    await expect(updateAuthConfig(REF, "t", { smtp_port: "465" }, f.impl)).rejects.toThrow("Auth settings request failed (400): smtp_port must be a string");
    await expect(readAuthConfig(REF, "t", f.impl)).rejects.toThrow("Auth settings request failed (502): Bad Gateway");
  });

  it("parses the command line: repeatable --redirect, flags, values, and rejects unknown arguments", () => {
    const args = parseArgs(["--project-ref", REF, "--site-url", "https://app.example.test", "--redirect", "https://app.example.test/auth/recovery", "--redirect", "https://app.example.test/", "--disable-signups", "--smtp-resend", "--sender", "n@example.test", "--sender-name", "Example", "--rate-limit-email-sent", "30", "--dry-run"]);
    expect(args.ref).toBe(REF);
    expect(args.options).toEqual({ siteUrl: "https://app.example.test", redirectUrls: ["https://app.example.test/auth/recovery", "https://app.example.test/"], disableSignup: true, rateLimitEmailSent: 30 });
    expect(args.smtpResend).toBe(true);
    expect(args.sender).toBe("n@example.test");
    expect(args.senderName).toBe("Example");
    expect(args.dryRun).toBe(true);
    expect(args.show).toBe(false);
    expect(() => parseArgs(["--site-url"])).toThrow(/needs a value/);
    expect(() => parseArgs(["--site-url", "--dry-run"])).toThrow(/needs a value/);
    expect(() => parseArgs(["--bogus"])).toThrow(/unknown argument/);
  });
});

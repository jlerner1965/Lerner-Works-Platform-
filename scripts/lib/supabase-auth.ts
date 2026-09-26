/**
 * Supabase Auth settings on a hosted project through the Management API (GET and PATCH
 * /v1/projects/{ref}/config/auth). Field names follow the published OpenAPI document of
 * api.supabase.com (UpdateAuthConfigBody): `site_url`, `uri_allow_list` (comma-separated),
 * `disable_signup`, the `smtp_*` fields (`smtp_port` is a string) and `rate_limit_email_sent`.
 * Nothing here prints a secret: summaries cover the managed fields only and the SMTP password
 * is redacted wherever a change set is shown. `fetchImpl` is injectable for tests.
 */

const API = "https://api.supabase.com";

/** Resend's SMTP relay as documented for Supabase Auth: implicit TLS on 465, user "resend", password = API key. */
export const RESEND_SMTP = { host: "smtp.resend.com", port: "465", user: "resend" } as const;

export interface SmtpSettings {
  host: string;
  port: string;
  user: string;
  pass: string;
  /** Sender address (Supabase calls it the admin email); its domain must be verified at the relay. */
  adminEmail: string;
  senderName: string;
}

export interface AuthSettingsOptions {
  siteUrl?: string;
  /** The complete redirect allow-list; it replaces the project's current list. */
  redirectUrls?: string[];
  disableSignup?: boolean;
  smtp?: SmtpSettings;
  /** Emails per hour Supabase Auth may send; meaningful only with custom SMTP. */
  rateLimitEmailSent?: number;
}

/** The managed fields as the API reports them; everything else in the response is dropped. */
export interface AuthConfigView {
  site_url?: string | null;
  uri_allow_list?: string | null;
  disable_signup?: boolean | null;
  smtp_host?: string | null;
  smtp_port?: string | null;
  smtp_user?: string | null;
  smtp_admin_email?: string | null;
  smtp_sender_name?: string | null;
  smtp_max_frequency?: number | null;
  rate_limit_email_sent?: number | null;
  external_email_enabled?: boolean | null;
}

export type AuthPatch = Record<string, string | number | boolean>;

const MANAGED_FIELDS: ReadonlyArray<keyof AuthConfigView> = [
  "site_url",
  "uri_allow_list",
  "disable_signup",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_admin_email",
  "smtp_sender_name",
  "smtp_max_frequency",
  "rate_limit_email_sent",
  "external_email_enabled",
];

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

function assertHttpsUrl(value: string, what: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${what} must be an absolute https URL (got "${value}")`);
  }
  if (parsed.protocol !== "https:" || value.includes(",")) {
    throw new Error(`${what} must be an https URL without commas (got "${value}")`);
  }
  return value;
}

/** Turns the requested settings into the PATCH body, validating each value; only requested fields appear. */
export function buildAuthPatch(options: AuthSettingsOptions): AuthPatch {
  const patch: AuthPatch = {};
  if (options.siteUrl !== undefined) patch.site_url = assertHttpsUrl(options.siteUrl, "the site URL");
  if (options.redirectUrls !== undefined) {
    if (options.redirectUrls.length === 0) throw new Error("the redirect allow-list must contain at least one URL");
    patch.uri_allow_list = options.redirectUrls.map((u) => assertHttpsUrl(u, "a redirect URL")).join(",");
  }
  if (options.disableSignup !== undefined) patch.disable_signup = options.disableSignup;
  if (options.smtp) {
    const s = options.smtp;
    if (!s.host || !s.port || !s.user) throw new Error("SMTP host, port and user are required");
    if (!s.pass) throw new Error("the SMTP password (the Resend API key) is empty");
    if (!EMAIL.test(s.adminEmail)) throw new Error(`the sender address "${s.adminEmail}" is not an email address`);
    if (!s.senderName.trim()) throw new Error("the sender name is empty");
    patch.smtp_host = s.host;
    patch.smtp_port = s.port;
    patch.smtp_user = s.user;
    patch.smtp_pass = s.pass;
    patch.smtp_admin_email = s.adminEmail;
    patch.smtp_sender_name = s.senderName.trim();
  }
  if (options.rateLimitEmailSent !== undefined) {
    if (!Number.isInteger(options.rateLimitEmailSent) || options.rateLimitEmailSent < 1) {
      throw new Error("the email rate limit must be a positive integer (emails per hour)");
    }
    patch.rate_limit_email_sent = options.rateLimitEmailSent;
  }
  if (Object.keys(patch).length === 0) {
    throw new Error("nothing to change: pass --site-url, --redirect, --disable-signups, --smtp-resend or --rate-limit-email-sent");
  }
  return patch;
}

/** The change set with the SMTP password replaced, for logs and dry runs. */
export function redactAuthPatch(patch: AuthPatch): AuthPatch {
  return "smtp_pass" in patch ? { ...patch, smtp_pass: "***" } : { ...patch };
}

function pick(body: unknown): AuthConfigView {
  const view: Record<string, unknown> = {};
  if (body && typeof body === "object") {
    for (const key of MANAGED_FIELDS) {
      if (key in body) view[key] = (body as Record<string, unknown>)[key];
    }
  }
  return view as AuthConfigView;
}

async function call(ref: string, token: string, method: "GET" | "PATCH", body: AuthPatch | undefined, fetchImpl: typeof fetch): Promise<AuthConfigView> {
  const res = await fetchImpl(`${API}/v1/projects/${ref}/config/auth`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[]; error?: string };
      message = Array.isArray(parsed.message) ? parsed.message.join("; ") : (parsed.message ?? parsed.error ?? text);
    } catch {
      /* plain text error */
    }
    throw new Error(`Auth settings request failed (${res.status}): ${message.slice(0, 500)}`);
  }
  return pick(text ? JSON.parse(text) : {});
}

/** Reads the managed Auth settings of a project. */
export function readAuthConfig(ref: string, token: string, fetchImpl: typeof fetch = fetch): Promise<AuthConfigView> {
  return call(ref, token, "GET", undefined, fetchImpl);
}

/** Applies a change set and returns the settings as the provider reports them afterwards (read back, not echoed). */
export async function updateAuthConfig(ref: string, token: string, patch: AuthPatch, fetchImpl: typeof fetch = fetch): Promise<AuthConfigView> {
  await call(ref, token, "PATCH", patch, fetchImpl);
  return readAuthConfig(ref, token, fetchImpl);
}

/** Every requested value the provider does not report back (the password cannot be read back and is skipped). */
export function verifyAuthPatch(patch: AuthPatch, after: AuthConfigView): string[] {
  const problems: string[] = [];
  for (const [key, expected] of Object.entries(patch)) {
    if (key === "smtp_pass") continue;
    const actual = (after as Record<string, unknown>)[key];
    if (String(actual) !== String(expected)) {
      problems.push(`${key}: expected ${JSON.stringify(expected)}, provider reports ${JSON.stringify(actual ?? null)}`);
    }
  }
  return problems;
}

/** Human-readable lines about the managed settings; never includes a secret. */
export function summarizeAuthConfig(c: AuthConfigView): string[] {
  const sender = c.smtp_host
    ? `custom SMTP ${c.smtp_host}:${c.smtp_port ?? "?"} as ${c.smtp_admin_email ?? "?"}${c.smtp_sender_name ? ` (${c.smtp_sender_name})` : ""}, user ${c.smtp_user ?? "?"}`
    : "default Supabase mailer (a few messages an hour; for testing only)";
  return [
    `site URL: ${c.site_url || "(unset)"}`,
    `redirect allow-list: ${c.uri_allow_list || "(empty)"}`,
    `sign-ups: ${c.disable_signup === true ? "disabled" : c.disable_signup === false ? "ENABLED" : "unknown"}`,
    `auth email sender: ${sender}`,
    `email rate limit: ${c.rate_limit_email_sent ?? "?"} per hour; minimum interval ${c.smtp_max_frequency ?? "?"} s`,
  ];
}

export interface HostedAuthArgs {
  ref?: string;
  show: boolean;
  dryRun: boolean;
  smtpResend: boolean;
  sender?: string;
  senderName?: string;
  options: AuthSettingsOptions;
}

/** Command-line arguments of `pnpm hosted:auth`; `--redirect` repeats. */
export function parseHostedAuthArgs(argv: string[]): HostedAuthArgs {
  const args: HostedAuthArgs = { show: false, dryRun: false, smtpResend: false, options: {} };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!;
    const value = (): string => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
      i++;
      return v;
    };
    switch (flag) {
      case "--project-ref":
        args.ref = value();
        break;
      case "--site-url":
        args.options.siteUrl = value();
        break;
      case "--redirect":
        (args.options.redirectUrls ??= []).push(value());
        break;
      case "--disable-signups":
        args.options.disableSignup = true;
        break;
      case "--smtp-resend":
        args.smtpResend = true;
        break;
      case "--sender":
        args.sender = value();
        break;
      case "--sender-name":
        args.senderName = value();
        break;
      case "--rate-limit-email-sent":
        args.options.rateLimitEmailSent = Number(value());
        break;
      case "--show":
        args.show = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        throw new Error(`unknown argument ${flag}`);
    }
  }
  return args;
}

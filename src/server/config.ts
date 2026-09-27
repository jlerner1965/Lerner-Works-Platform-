import { z } from "zod";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const optionalText = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional());

const schema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_HOST: z.string().min(1).default("localhost:3000"),
  /** Hostname under which uploaded sites are previewed as `<site key>.<PREVIEW_DOMAIN>` (B7); locally `preview.localhost`. Unset on a hosted runtime means no previews until it is. */
  PREVIEW_DOMAIN: optionalText,
  DATABASE_URL: z.string().min(1),
  DATABASE_ADMIN_URL: optionalText,
  AUTH_PROVIDER: z.enum(["local", "supabase"]).default("local"),
  SESSION_SECRET: z.string().min(16),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(14),
  STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".data/storage"),
  NOTIFY_PROVIDER: z.enum(["local-sink", "resend"]).default("local-sink"),
  NOTIFY_LOCAL_DIR: z.string().default(".data/mail"),
  NOTIFY_FROM_ADDRESS: z.string().default("notifications@platform.example"),
  NOTIFY_RESEND_API_KEY: optionalText,
  SUPABASE_URL: optionalText,
  SUPABASE_ANON_KEY: optionalText,
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
  SUPABASE_STORAGE_PRIVATE_BUCKET: z.string().default("private"),
  SUPABASE_STORAGE_PUBLIC_BUCKET: z.string().default("public-assets"),
  /** Bearer secret for the scheduled job endpoints; Vercel Cron supplies CRON_SECRET. */
  JOB_TRIGGER_SECRET: optionalText,
  CRON_SECRET: optionalText,
  VERCEL_API_TOKEN: optionalText,
  VERCEL_PROJECT_ID: optionalText,
  VERCEL_TEAM_ID: optionalText,
});

export type AppConfig = z.infer<typeof schema> & { isLocal: boolean; jobTriggerSecret: string | undefined };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

let cached: AppConfig | null = null;

/**
 * Parses and validates server configuration once. Fails fast on unsafe combinations: the
 * development-only providers never run outside a local environment, and a hosted
 * environment must name every provider and secret it depends on before the first request.
 */
export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server configuration: ${issues}. See .env.example.`);
  }
  const cfg = parsed.data;
  if (cfg.DATABASE_URL.includes("CHANGE_ME") || cfg.SESSION_SECRET.includes("CHANGE_ME")) {
    throw new Error("Configuration still contains CHANGE_ME placeholders. Run `pnpm db:start`.");
  }
  const isLocal = cfg.APP_ENV === "local";
  if (cfg.AUTH_PROVIDER === "local" && (!isLocal || !LOCAL_HOSTS.has(hostOf(cfg.DATABASE_URL)))) {
    throw new Error(
      "AUTH_PROVIDER=local is a development-only provider: it requires APP_ENV=local and a local DATABASE_URL. Use AUTH_PROVIDER=supabase for hosted environments.",
    );
  }
  if (cfg.AUTH_PROVIDER === "supabase" && (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !cfg.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("AUTH_PROVIDER=supabase requires SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (cfg.STORAGE_PROVIDER === "supabase" && (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("STORAGE_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (cfg.NOTIFY_PROVIDER === "resend" && !cfg.NOTIFY_RESEND_API_KEY) {
    throw new Error("NOTIFY_PROVIDER=resend requires NOTIFY_RESEND_API_KEY.");
  }
  const jobTriggerSecret = cfg.JOB_TRIGGER_SECRET ?? cfg.CRON_SECRET;
  if (jobTriggerSecret !== undefined && jobTriggerSecret.length < 32) {
    throw new Error("JOB_TRIGGER_SECRET (or CRON_SECRET) must be at least 32 characters.");
  }
  if (!isLocal) {
    const problems: string[] = [];
    if (!cfg.APP_URL.startsWith("https://")) problems.push("APP_URL must use https");
    if (LOCAL_HOSTS.has(hostOf(cfg.DATABASE_URL))) problems.push("DATABASE_URL must not point at a local host");
    if (cfg.AUTH_PROVIDER !== "supabase") problems.push("AUTH_PROVIDER must be supabase");
    if (cfg.STORAGE_PROVIDER !== "supabase") problems.push("STORAGE_PROVIDER must be supabase (local disk storage is not durable on a hosted runtime)");
    if (cfg.NOTIFY_PROVIDER !== "resend") problems.push("NOTIFY_PROVIDER must be resend (the local sink sends no email)");
    if (!cfg.DATABASE_ADMIN_URL) problems.push("DATABASE_ADMIN_URL is required for the scheduled job endpoints");
    if (!jobTriggerSecret) problems.push("JOB_TRIGGER_SECRET (or CRON_SECRET) is required for the scheduled job endpoints");
    if (problems.length) {
      throw new Error(`Hosted configuration (APP_ENV=${cfg.APP_ENV}) is incomplete: ${problems.join("; ")}. See docs/LAUNCH-CHECKLIST.md.`);
    }
  }
  const previewDomain = (cfg.PREVIEW_DOMAIN ?? (isLocal ? "preview.localhost" : "")).toLowerCase().replace(/:\d+$/, "");
  if (previewDomain && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(previewDomain)) {
    throw new Error("PREVIEW_DOMAIN must be a hostname such as preview.example.com (no scheme, no port).");
  }
  cached = { ...cfg, PREVIEW_DOMAIN: previewDomain || undefined, isLocal, jobTriggerSecret };
  return cached;
}

/** The preview address of an uploaded site (B7), or null where no preview hostname is configured. */
export function previewOrigin(siteKey: string): string | null {
  const cfg = getConfig();
  if (!cfg.PREVIEW_DOMAIN) return null;
  const app = new URL(cfg.APP_URL);
  const port = app.port ? `:${app.port}` : "";
  return `${app.protocol}//${siteKey}.${cfg.PREVIEW_DOMAIN}${port}`;
}

/** Test hook: forget the cached configuration so a changed environment is re-read. */
export function resetConfigForTests(): void {
  cached = null;
}

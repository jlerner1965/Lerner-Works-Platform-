import { z } from "zod";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const schema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_HOST: z.string().min(1).default("localhost:3000"),
  DATABASE_URL: z.string().min(1),
  DATABASE_ADMIN_URL: z.string().optional(),
  AUTH_PROVIDER: z.enum(["local", "supabase"]).default("local"),
  SESSION_SECRET: z.string().min(16),
  STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".data/storage"),
  NOTIFY_PROVIDER: z.enum(["local-sink", "resend"]).default("local-sink"),
  NOTIFY_LOCAL_DIR: z.string().default(".data/mail"),
  NOTIFY_FROM_ADDRESS: z.string().default("notifications@platform.example"),
  NOTIFY_RESEND_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof schema> & { isLocal: boolean };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

let cached: AppConfig | null = null;

/** Parses and validates server configuration once. Fails fast on unsafe combinations. */
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
  if (cfg.AUTH_PROVIDER === "supabase" && (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY)) {
    throw new Error("AUTH_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  if (cfg.STORAGE_PROVIDER === "supabase" && (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("STORAGE_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  cached = { ...cfg, isLocal };
  return cached;
}

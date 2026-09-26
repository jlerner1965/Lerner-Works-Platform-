/**
 * Documented retention job: purges short-lived rate-limit counters and inquiries older than
 * the retention period (default 90 days; product default requiring owner review before real
 * collection). Refuses to run against a non-local target unless --confirm-hosted is passed.
 */
import postgres from "postgres";
import { loadEnv, requireEnv, isLocalDatabaseUrl, redactUrl } from "./lib/env";

loadEnv();

async function main(): Promise<void> {
  const url = requireEnv("DATABASE_ADMIN_URL");
  const days = Number(process.argv.find((a) => a.startsWith("--days="))?.slice(7) ?? "90");
  if (!isLocalDatabaseUrl(url) && !process.argv.includes("--confirm-hosted")) {
    console.error(`Refusing to purge on non-local target ${redactUrl(url)} without --confirm-hosted.`);
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const rl = (await sql<{ n: number }[]>`select public.purge_rate_limit_events(interval '1 day') as n`)[0]?.n ?? 0;
    const inq = (await sql<{ n: number }[]>`select public.purge_old_inquiries((${days} || ' days')::interval) as n`)[0]?.n ?? 0;
    console.log(`Purged ${rl} rate-limit events older than 1 day and ${inq} inquiries older than ${days} days.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

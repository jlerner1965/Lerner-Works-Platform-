/**
 * Processes notification delivery jobs with the configured provider. Local mode uses the
 * local sink (NOTIFY_LOCAL_DIR). Use --once to process a single batch and exit.
 */
import { loadEnv, requireEnv } from "./lib/env";
import postgres from "postgres";
import { processDeliveryJobs } from "@/server/inquiries/worker";
import { getNotificationProvider } from "@/server/inquiries/notify";

loadEnv();

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  const adminUrl = requireEnv("DATABASE_ADMIN_URL");
  const admin = postgres(adminUrl, { max: 2, onnotice: () => {}, transform: postgres.camel });
  const provider = getNotificationProvider();
  console.log(`Notification worker started (provider: ${provider.name}${provider.name === "local-sink" ? `, sink: ${process.env.NOTIFY_LOCAL_DIR ?? ".data/mail"}` : ""}). ${once ? "Processing one batch." : "Polling every 5 seconds; Ctrl+C to stop."}`);
  let running = true;
  process.on("SIGINT", () => (running = false));
  process.on("SIGTERM", () => (running = false));
  try {
    do {
      const r = await processDeliveryJobs(admin, provider, { limit: 20 });
      if (r.claimed > 0) {
        console.log(`${new Date().toISOString()} claimed ${r.claimed}: delivered ${r.delivered}, retried ${r.retried}, failed ${r.failed}`);
        for (const d of r.details) console.log(`  ${d.jobId.slice(0, 8)} ${d.outcome}`);
      }
      if (once) break;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } while (running);
  } finally {
    await admin.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

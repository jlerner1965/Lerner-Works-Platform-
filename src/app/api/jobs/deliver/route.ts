import { authorizeJobRequest, jobResponse } from "@/server/jobs/auth";
import { elevatedDb } from "@/server/data/elevated";
import { processDeliveryJobs } from "@/server/inquiries/worker";
import { getNotificationProvider } from "@/server/inquiries/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled notification delivery for hosted environments: one bounded batch per call,
 * authenticated with the job secret. Vercel Cron calls GET; other schedulers may POST.
 * Two overlapping calls never send the same job because claims are leased in the database.
 */
async function run(request: Request): Promise<Response> {
  const denied = authorizeJobRequest(request);
  if (denied) return denied;
  const startedAt = new Date();
  try {
    const provider = getNotificationProvider();
    const result = await processDeliveryJobs(elevatedDb(), provider, { limit: 25 });
    return jobResponse({
      ok: true,
      job: "deliver",
      provider: provider.name,
      claimed: result.claimed,
      delivered: result.delivered,
      retried: result.retried,
      failed: result.failed,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
    });
  } catch (err) {
    return jobResponse({ ok: false, job: "deliver", error: err instanceof Error ? err.message : "job failed" }, 500);
  }
}

export const GET = run;
export const POST = run;

import { authorizeJobRequest, jobResponse } from "@/server/jobs/auth";
import { elevatedDb } from "@/server/data/elevated";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const INQUIRY_RETENTION_DAYS = 90;

/**
 * Scheduled retention for hosted environments: purges rate-limit counters older than a day
 * and inquiries older than the documented retention period. Same authentication as the
 * delivery job.
 */
async function run(request: Request): Promise<Response> {
  const denied = authorizeJobRequest(request);
  if (denied) return denied;
  try {
    const admin = elevatedDb();
    const rateLimit = (await admin<{ n: number }[]>`select public.purge_rate_limit_events(interval '1 day') as n`)[0]?.n ?? 0;
    const inquiries = (await admin<{ n: number }[]>`select public.purge_old_inquiries((${INQUIRY_RETENTION_DAYS} || ' days')::interval) as n`)[0]?.n ?? 0;
    return jobResponse({ ok: true, job: "retention", purgedRateLimitEvents: rateLimit, purgedInquiries: inquiries, inquiryRetentionDays: INQUIRY_RETENTION_DAYS, ranAt: new Date().toISOString() });
  } catch (err) {
    return jobResponse({ ok: false, job: "retention", error: err instanceof Error ? err.message : "job failed" }, 500);
  }
}

export const GET = run;
export const POST = run;

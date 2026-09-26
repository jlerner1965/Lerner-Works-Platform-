import type { Sql } from "postgres";
import type { NotificationProvider } from "@/server/inquiries/notify";

/** Bounded backoff for transient failures: after 1, 5 and 30 minutes. */
export function backoffMinutes(attempt: number): number {
  return [1, 5, 30][Math.min(attempt, 3) - 1] ?? 30;
}

const LEASE_MINUTES = 2;

export interface ProcessResult {
  claimed: number;
  delivered: number;
  retried: number;
  failed: number;
  details: Array<{ jobId: string; outcome: string }>;
}

interface ClaimedJob {
  id: string;
  inquiryId: string;
  siteId: string;
  recipients: string[];
  attemptCount: number;
  maxAttempts: number;
}

/**
 * Claims due jobs with a lease (FOR UPDATE SKIP LOCKED, so two workers never send the same
 * job), sends through the provider outside any transaction, then records the outcome.
 * Runs with elevated database access; only the worker process may call it.
 */
export async function processDeliveryJobs(admin: Sql, provider: NotificationProvider, opts: { limit?: number; now?: Date } = {}): Promise<ProcessResult> {
  const limit = opts.limit ?? 10;
  const result: ProcessResult = { claimed: 0, delivered: 0, retried: 0, failed: 0, details: [] };
  const jobs = await admin<ClaimedJob[]>`
    with due as (
      select id from public.delivery_jobs
      where (state = 'pending' and next_attempt_at <= now())
         or (state = 'processing' and lease_expires_at < now())
      order by next_attempt_at
      limit ${limit}
      for update skip locked
    )
    update public.delivery_jobs j
      set state = 'processing', lease_expires_at = now() + (${LEASE_MINUTES} || ' minutes')::interval, attempt_count = j.attempt_count + 1, provider = ${provider.name}
      from due where j.id = due.id
      returning j.id, j.inquiry_id, j.site_id, j.recipients, j.attempt_count, j.max_attempts`;
  result.claimed = jobs.length;
  for (const job of jobs) {
    const [inq] = await admin<{ receiptCode: string; name: string; email: string; phone: string | null; message: string; sourcePath: string | null; locationLabel: string | null; receivedAt: Date; siteName: string; siteKey: string }[]>`
      select i.receipt_code, i.name, i.email, i.phone, i.message, i.source_path, i.location_label, i.received_at, s.name as site_name, s.key as site_key
      from public.inquiries i join public.sites s on s.id = i.site_id where i.id = ${job.inquiryId}`;
    if (!inq) {
      await admin`update public.delivery_jobs set state = 'failed', last_error = 'inquiry no longer exists', lease_expires_at = null where id = ${job.id}`;
      result.failed++;
      result.details.push({ jobId: job.id, outcome: "failed: inquiry missing" });
      continue;
    }
    if (job.recipients.length === 0) {
      await admin`update public.delivery_jobs set state = 'failed', last_error = 'no notification recipients are configured for this site', lease_expires_at = null where id = ${job.id}`;
      result.failed++;
      result.details.push({ jobId: job.id, outcome: "failed: no recipients" });
      continue;
    }
    const text = [
      `New inquiry for ${inq.siteName} (receipt ${inq.receiptCode})`,
      `Received: ${inq.receivedAt.toISOString()}`,
      `From: ${inq.name} <${inq.email}>${inq.phone ? ` · ${inq.phone}` : ""}`,
      inq.locationLabel ? `Location: ${inq.locationLabel}` : null,
      inq.sourcePath ? `Page: ${inq.sourcePath}` : null,
      "",
      inq.message,
      "",
      "Open the inbox in the Lerner Works dashboard to respond and update the status.",
    ].filter((l) => l !== null).join("\n");
    const sent = await provider.send({ to: job.recipients, subject: `[${inq.siteName}] New inquiry ${inq.receiptCode}`, text, idempotencyKey: `inquiry-${job.inquiryId}` });
    if (sent.ok) {
      await admin`update public.delivery_jobs set state = 'delivered', provider_reference = ${sent.reference}, provider_accepted = ${sent.accepted}, delivered_at = now(), lease_expires_at = null, last_error = null where id = ${job.id}`;
      result.delivered++;
      result.details.push({ jobId: job.id, outcome: `delivered (${sent.reference})` });
    } else if (sent.transient && job.attemptCount < job.maxAttempts) {
      const minutes = backoffMinutes(job.attemptCount);
      await admin`update public.delivery_jobs set state = 'pending', next_attempt_at = now() + (${minutes} || ' minutes')::interval, lease_expires_at = null, last_error = ${sent.error} where id = ${job.id}`;
      result.retried++;
      result.details.push({ jobId: job.id, outcome: `retry in ${minutes} min: ${sent.error}` });
    } else {
      await admin`update public.delivery_jobs set state = 'failed', lease_expires_at = null, last_error = ${sent.error} where id = ${job.id}`;
      result.failed++;
      result.details.push({ jobId: job.id, outcome: `failed: ${sent.error}` });
    }
  }
  return result;
}

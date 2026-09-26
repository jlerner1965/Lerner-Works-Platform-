import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import { seedInfo, withAnon, withUser, endPool, adminClient, key } from "./helpers";
import { processDeliveryJobs } from "@/server/inquiries/worker";
import { FailingProvider, LocalSinkProvider } from "@/server/inquiries/notify";

const { users } = seedInfo();

afterAll(async () => {
  await endPool();
});

async function submit(): Promise<string> {
  const rows = await withAnon((db) => db<{ inquiryId: string }[]>`select inquiry_id from public.submit_inquiry('range-athletics', null, ${db.json({ name: "Queue Test", email: "queue@example.test", message: "Testing the delivery queue." })}, ${"hash-" + key()}, ${key()})`);
  return rows[0]!.inquiryId;
}

describe("notification queue (LEAD-02)", () => {
  it("keeps the inquiry when the provider fails, retries with backoff, then fails visibly and can be retried by a publisher", async () => {
    const admin = adminClient();
    try {
      const inquiryId = await submit();
      const failing = new FailingProvider(true);
      // Attempt 1: transient failure → pending with backoff.
      let r = await processDeliveryJobs(admin, failing, { limit: 50 });
      expect(r.claimed).toBeGreaterThanOrEqual(1);
      let [job] = await admin<{ state: string; attemptCount: number; nextAttemptAt: Date; lastError: string }[]>`select state::text, attempt_count, next_attempt_at, last_error from public.delivery_jobs where inquiry_id = ${inquiryId}`;
      expect(job).toMatchObject({ state: "pending", attemptCount: 1, lastError: "simulated provider outage" });
      expect(job!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 50_000);
      // Force the remaining attempts to be due now and exhaust them.
      for (let i = 0; i < 3; i++) {
        await admin`update public.delivery_jobs set next_attempt_at = now() where inquiry_id = ${inquiryId}`;
        r = await processDeliveryJobs(admin, failing, { limit: 50 });
      }
      [job] = await admin<{ state: string; attemptCount: number; nextAttemptAt: Date; lastError: string }[]>`select state::text, attempt_count, next_attempt_at, last_error from public.delivery_jobs where inquiry_id = ${inquiryId}`;
      expect(job).toMatchObject({ state: "failed", attemptCount: 4 });
      const stored = await admin`select id from public.inquiries where id = ${inquiryId}`;
      expect(stored.length).toBe(1);
      // Editors cannot retry; publishers can.
      const asEditor = await withUser(users.editorA, (db) => db`update public.delivery_jobs set state = 'pending' where inquiry_id = ${inquiryId}`);
      expect(asEditor.count).toBe(0);
      const asPublisher = await withUser(users.publisherB, (db) => db`update public.delivery_jobs set state = 'pending', next_attempt_at = now(), lease_expires_at = null where inquiry_id = ${inquiryId} and state = 'failed'`);
      expect(asPublisher.count).toBe(1);
      // Now the sink succeeds and writes a file.
      const dir = ".data/test-mail";
      const sink = new LocalSinkProvider(dir);
      r = await processDeliveryJobs(admin, sink, { limit: 50 });
      expect(r.delivered).toBeGreaterThanOrEqual(1);
      [job] = await admin<{ state: string; attemptCount: number; nextAttemptAt: Date; lastError: string; providerReference: string }[]>`select state::text, attempt_count, next_attempt_at, last_error, provider_reference from public.delivery_jobs where inquiry_id = ${inquiryId}`;
      expect(job!.state).toBe("delivered");
      const content = fs.readFileSync(`${dir}/${(job as unknown as { providerReference: string }).providerReference}`, "utf8");
      expect(content).toContain("Testing the delivery queue.");
      expect(content).toContain("To: stores@rangeathletics.example");
    } finally {
      await admin.end();
    }
  });

  it("does not let two workers process the same job (lease with SKIP LOCKED)", async () => {
    const admin1 = adminClient();
    const admin2 = adminClient();
    try {
      const inquiryId = await submit();
      const sink = new LocalSinkProvider(".data/test-mail");
      const [a, b] = await Promise.all([processDeliveryJobs(admin1, sink, { limit: 50 }), processDeliveryJobs(admin2, sink, { limit: 50 })]);
      const total = a.details.filter((d) => d.outcome.startsWith("delivered")).length + b.details.filter((d) => d.outcome.startsWith("delivered")).length;
      const jobs = await admin1`select id from public.delivery_jobs where inquiry_id = ${inquiryId} and state = 'delivered'`;
      expect(jobs.length).toBe(1);
      expect(total).toBeGreaterThanOrEqual(1);
    } finally {
      await admin1.end();
      await admin2.end();
    }
  });
});

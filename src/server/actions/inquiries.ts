"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";

export interface InquiryActionState {
  message?: string;
  error?: string;
}

const uuid = z.uuid();
const statuses = ["new", "in_progress", "resolved", "spam"] as const;

export async function updateInquiryAction(_prev: InquiryActionState, formData: FormData): Promise<InquiryActionState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const status = String(formData.get("status") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 4000);
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(inquiryId).success) return { error: "Invalid request." };
  if (!(statuses as readonly string[]).includes(status)) return { error: "Choose a valid status." };
  try {
    const ok = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canViewInquiries) return false;
      const r = await db`update public.inquiries set status = ${status}, notes = ${notes || null}, updated_by = ${user.id} where id = ${inquiryId} and site_id = ${siteId}`;
      if (r.count === 1) {
        await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata)
          values (${ctx.site.organizationId}, ${siteId}, ${user.id}, 'inquiry.status_changed', 'inquiry', ${inquiryId}, ${db.json({ status })})`;
      }
      return r.count === 1;
    });
    if (!ok) return { error: "The inquiry could not be updated." };
    revalidatePath(`/app/sites/${siteId}/inquiries`);
    revalidatePath(`/app/sites/${siteId}/inquiries/${inquiryId}`);
    return { message: `Marked as ${status.replace("_", " ")}.` };
  } catch (err) {
    return { error: describeDbError(err).message };
  }
}

/** Publisher-only: re-queues a failed notification job. */
export async function retryDeliveryAction(_prev: InquiryActionState, formData: FormData): Promise<InquiryActionState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const inquiryId = String(formData.get("inquiryId") ?? "");
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(jobId).success) return { error: "Invalid request." };
  try {
    const ok = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canPublish) return false;
      const r = await db`update public.delivery_jobs set state = 'pending', next_attempt_at = now(), lease_expires_at = null, last_error = null
        where id = ${jobId} and site_id = ${siteId} and state = 'failed'`;
      return r.count === 1;
    });
    if (!ok) return { error: "Only failed jobs can be retried, and only by publishers or owners." };
    revalidatePath(`/app/sites/${siteId}/inquiries/${inquiryId}`);
    return { message: "Notification re-queued. The worker will pick it up on its next pass." };
  } catch (err) {
    return { error: describeDbError(err).message };
  }
}

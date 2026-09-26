"use client";

import { useActionState, useId } from "react";
import { updateInquiryAction, retryDeliveryAction, type InquiryActionState } from "@/server/actions/inquiries";
import { Alert, Button, selectClass, inputClass } from "@/components/admin/ui";

export function InquiryStatusForm({ siteId, inquiryId, status, notes }: { siteId: string; inquiryId: string; status: string; notes: string }) {
  const [state, action, pending] = useActionState<InquiryActionState, FormData>(updateInquiryAction, {});
  const id = useId();
  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="inquiryId" value={inquiryId} />
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <label htmlFor={`${id}-status`} className="block font-medium">Status</label>
      <select id={`${id}-status`} name="status" defaultValue={status} className={selectClass}>
        <option value="new">New</option>
        <option value="in_progress">In progress</option>
        <option value="resolved">Resolved</option>
        <option value="spam">Spam</option>
      </select>
      <label htmlFor={`${id}-notes`} className="block font-medium">Internal notes</label>
      <textarea id={`${id}-notes`} name="notes" defaultValue={notes} rows={3} className={`${inputClass} min-h-20`} maxLength={4000} />
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save status"}</Button>
    </form>
  );
}

export function RetryDeliveryForm({ siteId, inquiryId, jobId }: { siteId: string; inquiryId: string; jobId: string }) {
  const [state, action, pending] = useActionState<InquiryActionState, FormData>(retryDeliveryAction, {});
  return (
    <form action={action} className="text-sm">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <input type="hidden" name="jobId" value={jobId} />
      {state.message ? <p className="mb-1 text-success">{state.message}</p> : null}
      {state.error ? <p className="mb-1 text-danger">{state.error}</p> : null}
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Queuing…" : "Retry notification"}</Button>
    </form>
  );
}

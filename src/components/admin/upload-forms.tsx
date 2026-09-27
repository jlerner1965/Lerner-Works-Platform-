"use client";

import { useActionState, useId } from "react";
import { publishUploadAction, type PublishUploadState } from "@/server/actions/uploaded";
import { Alert, Button, inputClass } from "@/components/admin/ui";

/** Publishes a checked upload as the next release (B7). */
export function PublishUploadForm({ siteId, jobId, version }: { siteId: string; jobId: string; version: number }) {
  const [state, action, pending] = useActionState<PublishUploadState, FormData>(publishUploadAction, {});
  const id = useId();
  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="jobId" value={jobId} />
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <label htmlFor={`${id}-reason`} className="block font-medium">Note for the release history (optional)</label>
      <input id={`${id}-reason`} name="reason" className={`${inputClass} max-w-lg`} maxLength={300} placeholder="What changed in this version" />
      <Button type="submit" disabled={pending}>{pending ? "Publishing…" : `Publish as release v${version}`}</Button>
      <p className="text-xs text-ink-subtle">The files go to the public store under their content hashes, then the release is activated in one step. Earlier releases stay and can be restored.</p>
    </form>
  );
}

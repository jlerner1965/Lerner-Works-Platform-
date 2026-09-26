"use client";

import { useActionState, useId } from "react";
import { activateCandidateAction, waiveWarningAction, restoreReleaseAction, type PublishState, type WaiveState, type RestoreState } from "@/server/actions/publishing";
import { Alert, Button, inputClass } from "@/components/admin/ui";

export function ActivateForm({ siteId, candidateId, idempotencyKey, demoUrl, unwaived }: { siteId: string; candidateId: string; idempotencyKey: string; demoUrl: string | null; unwaived: number }) {
  const [state, action, pending] = useActionState<PublishState, FormData>(activateCandidateAction, {});
  const id = useId();
  const done = state.result && (state.result.outcome === "activated" || state.result.outcome === "already_activated");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {state.message ? (
        <Alert tone="success" title={state.message}>
          {done && state.result && "releaseId" in state.result ? (
            <p>
              Release <code>{state.result.releaseId.slice(0, 8)}</code> is now active.{" "}
              {demoUrl ? <a href={demoUrl} target="_blank" rel="noreferrer" className="underline">Open the published site</a> : "The live domain serves it immediately."}{" "}
              <a href={`/app/sites/${siteId}/publishing`} className="underline">Back to publishing</a>
            </p>
          ) : null}
        </Alert>
      ) : null}
      {state.error ? (
        <Alert tone="danger" title={state.result?.outcome === "conflict" ? "Conflict" : state.result?.outcome === "blocked" ? "Blocked" : "Activation failed"} role="alert">
          <p>{state.error}</p>
          {state.result?.outcome === "assets_failed" ? <p className="mt-1">The previous release stays active. Fix the asset and retry.</p> : null}
          {state.result?.outcome === "conflict" ? <p className="mt-1"><a href={`/app/sites/${siteId}/publishing`} className="underline">Build a new candidate</a></p> : null}
        </Alert>
      ) : null}
      {!done ? (
        <>
          {unwaived > 0 ? <p className="text-sm text-warning">{unwaived} warning(s) are not waived. Activation is still allowed; blockers are what stop it.</p> : null}
          <div>
            <label htmlFor={`${id}-reason`} className="mb-1 block text-sm font-medium">Reason (optional, stored with the release)</label>
            <input id={`${id}-reason`} name="reason" className={`${inputClass} max-w-lg`} maxLength={300} />
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Activating…" : "Activate this candidate"}</Button>
          <p className="text-xs text-ink-subtle">Activation is atomic: the release is inserted and the active pointer advanced in one transaction, checked against the candidate&apos;s base release. Repeating this exact form cannot create a second release.</p>
        </>
      ) : null}
    </form>
  );
}

export function WaiveForm({ candidateId, finding }: { candidateId: string; finding: { code: string; itemId?: string; field?: string } }) {
  const [state, action, pending] = useActionState<WaiveState, FormData>(waiveWarningAction, {});
  const id = useId();
  if (state.message) return <p className="text-xs text-success">{state.message}</p>;
  return (
    <form action={action} className="mt-1 flex flex-wrap items-end gap-2">
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="code" value={finding.code} />
      <input type="hidden" name="itemId" value={finding.itemId ?? ""} />
      <input type="hidden" name="field" value={finding.field ?? ""} />
      <label htmlFor={`${id}-reason`} className="flex flex-col text-xs">Waive with reason<input id={`${id}-reason`} name="reason" className="mt-0.5 rounded border border-line-strong px-2 py-1 text-sm" required minLength={3} /></label>
      <Button type="submit" variant="secondary" disabled={pending}>Waive</Button>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function RestoreForm({ siteId, releaseId, idempotencyKey, version, blockedReason, isActive }: { siteId: string; releaseId: string; idempotencyKey: string; version: number; blockedReason: string | null; isActive: boolean }) {
  const [state, action, pending] = useActionState<RestoreState, FormData>(restoreReleaseAction, {});
  const id = useId();
  if (isActive) return <p className="text-sm text-ink-muted">This release is currently active.</p>;
  if (blockedReason) return <Alert tone="danger" title="Restore blocked">{blockedReason}. Replace or remove the affected asset in a new release instead.</Alert>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="releaseId" value={releaseId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {state.message ? <Alert tone="success">{state.message} <a href={`/app/sites/${siteId}/publishing`} className="underline">Back to publishing</a></Alert> : null}
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      {!state.releaseId ? (
        <>
          <label htmlFor={`${id}-reason`} className="block text-sm font-medium">Reason for restoring v{version}</label>
          <input id={`${id}-reason`} name="reason" required minLength={3} className={`${inputClass} max-w-lg`} />
          <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Restoring…" : `Restore v${version} as a new release`}</Button>
          <p className="text-xs text-ink-subtle">Restoring never deletes newer releases, drafts or inquiries. It creates a new release with this snapshot.</p>
        </>
      ) : null}
    </form>
  );
}

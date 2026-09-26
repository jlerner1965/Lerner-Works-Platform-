"use client";

import { useActionState, useId } from "react";
import { updateMediaAction, withdrawMediaAction, type MediaActionState } from "@/server/actions/media";
import { Alert, Button, inputClass } from "@/components/admin/ui";

export function MediaMetadataForm({ siteId, assetId, values, disabled }: { siteId: string; assetId: string; values: { title: string; altText: string; decorative: boolean; attributionText: string; license: string; sourceUrl: string }; disabled: boolean }) {
  const [state, action, pending] = useActionState<MediaActionState, FormData>(updateMediaAction, {});
  const id = useId();
  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="assetId" value={assetId} />
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <div><label htmlFor={`${id}-title`} className="mb-1 block font-medium">Title</label><input id={`${id}-title`} name="title" defaultValue={values.title} className={inputClass} maxLength={200} disabled={disabled} /></div>
      <div><label htmlFor={`${id}-alt`} className="mb-1 block font-medium">Alternative text</label><input id={`${id}-alt`} name="altText" defaultValue={values.altText} className={inputClass} maxLength={500} disabled={disabled} /><p className="mt-1 text-xs text-ink-subtle">Required for publication unless the image is decorative.</p></div>
      <label className="flex items-center gap-2"><input type="checkbox" name="decorative" defaultChecked={values.decorative} disabled={disabled} /> Decorative only</label>
      <div><label htmlFor={`${id}-license`} className="mb-1 block font-medium">License / rights</label><input id={`${id}-license`} name="license" defaultValue={values.license} className={inputClass} maxLength={200} disabled={disabled} /><p className="mt-1 text-xs text-ink-subtle">Required for publication. Record who owns the image and under which terms it may be published.</p></div>
      <div><label htmlFor={`${id}-attr`} className="mb-1 block font-medium">Attribution</label><input id={`${id}-attr`} name="attributionText" defaultValue={values.attributionText} className={inputClass} maxLength={500} disabled={disabled} /></div>
      <div><label htmlFor={`${id}-src`} className="mb-1 block font-medium">Source URL</label><input id={`${id}-src`} name="sourceUrl" defaultValue={values.sourceUrl} className={inputClass} maxLength={1000} disabled={disabled} /></div>
      <Button type="submit" disabled={pending || disabled}>{pending ? "Saving…" : "Save metadata"}</Button>
    </form>
  );
}

export function WithdrawForm({ siteId, assetId }: { siteId: string; assetId: string }) {
  const [state, action, pending] = useActionState<MediaActionState, FormData>(withdrawMediaAction, {});
  const id = useId();
  return (
    <form action={action} className="space-y-2 text-sm">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="assetId" value={assetId} />
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <label htmlFor={`${id}-reason`} className="block font-medium">Reason</label>
      <input id={`${id}-reason`} name="reason" required minLength={3} className={inputClass} maxLength={300} />
      <Button type="submit" variant="danger" disabled={pending}>{pending ? "Withdrawing…" : "Withdraw asset"}</Button>
    </form>
  );
}

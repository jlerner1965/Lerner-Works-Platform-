"use client";

import { useActionState } from "react";
import { confirmImportAction, remapImportAction, type ImportState } from "@/server/actions/import";
import { Alert, Button, selectClass } from "@/components/admin/ui";

export function ConfirmImportForm({ siteId, jobId, disabled, label }: { siteId: string; jobId: string; disabled: boolean; label: string }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(confirmImportAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="jobId" value={jobId} />
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <Button type="submit" disabled={disabled || pending}>{pending ? "Importing…" : label}</Button>
    </form>
  );
}

export function RemapForm({ siteId, jobId, columns, headers, mapping }: { siteId: string; jobId: string; columns: Array<{ key: string; required: boolean }>; headers: string[]; mapping: Record<string, string> }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(remapImportAction, {});
  return (
    <form action={action} className="space-y-2 text-sm">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="jobId" value={jobId} />
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {columns.map((c) => (
          <label key={c.key} className="grid grid-cols-[1fr_1fr] items-center gap-2 text-xs">
            <span><code>{c.key}</code>{c.required ? " *" : ""}</span>
            <select name={`map_${c.key}`} defaultValue={mapping[c.key] ?? ""} className={selectClass}>
              <option value="">— not mapped —</option>
              {headers.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
        ))}
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Re-running…" : "Apply mapping and re-run dry run"}</Button>
    </form>
  );
}

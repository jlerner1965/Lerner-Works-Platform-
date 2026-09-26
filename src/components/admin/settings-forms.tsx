"use client";

import { useActionState, type ReactNode } from "react";
import type { SettingsState } from "@/server/actions/settings";
import { Alert, Button } from "@/components/admin/ui";

/** Generic settings section: a form bound to a server action with message/error display. */
export function SettingsSection({ action, submitLabel = "Save", children, hidden }: { action: (prev: SettingsState, formData: FormData) => Promise<SettingsState>; submitLabel?: string; children: ReactNode; hidden: Record<string, string> }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(action, {});
  const fieldErrors = Object.entries(state.fieldErrors ?? {});
  return (
    <form action={formAction} className="space-y-3 text-sm">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state.error ? (
        <Alert tone="danger" role="alert">
          <p>{state.error}</p>
          {fieldErrors.length ? (
            <ul className="mt-1 list-disc pl-5">
              {fieldErrors.map(([field, message]) => (
                <li key={field}><span className="font-medium">{field}</span>: {message}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {children}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
    </form>
  );
}

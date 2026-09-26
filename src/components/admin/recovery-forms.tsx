"use client";

import { useActionState } from "react";
import { requestPasswordRecoveryAction, completePasswordRecoveryAction, type RecoveryState } from "@/server/actions/recovery";
import { Alert, Button, inputClass } from "@/components/admin/ui";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<RecoveryState, FormData>(requestPasswordRecoveryAction, {});
  return (
    <form action={action} className="space-y-4 rounded border border-line bg-surface p-6 shadow-sm" noValidate>
      {state.message ? <Alert tone="success" role="status">{state.message}</Alert> : null}
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <label className="block text-sm">Email
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </label>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending…" : "Send recovery link"}</Button>
    </form>
  );
}

export function RecoveryForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<RecoveryState, FormData>(completePasswordRecoveryAction, {});
  return (
    <form action={action} className="space-y-4 rounded border border-line bg-surface p-6 shadow-sm" noValidate>
      <input type="hidden" name="code" value={code} />
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <label className="block text-sm">New password (at least 12 characters)
        <input name="password" type="password" autoComplete="new-password" required minLength={12} className={inputClass} />
      </label>
      <label className="block text-sm">Confirm new password
        <input name="confirm" type="password" autoComplete="new-password" required minLength={12} className={inputClass} />
      </label>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Set new password and sign in"}</Button>
    </form>
  );
}

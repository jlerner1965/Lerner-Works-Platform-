"use client";

import { useActionState, useId } from "react";
import { acceptInvitationAction, registerAndAcceptAction, type InviteState } from "@/server/actions/invite";
import { Alert, Button, inputClass } from "@/components/admin/ui";

export function InviteAcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(acceptInvitationAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <Button type="submit" disabled={pending}>{pending ? "Accepting…" : "Accept invitation"}</Button>
    </form>
  );
}

export function InviteRegisterForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(registerAndAcceptAction, {});
  const id = useId();
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <p className="text-sm">Create your account for <strong>{email}</strong> (local development sign-in).</p>
      <label htmlFor={`${id}-pw`} className="block text-sm font-medium">Password (12+ characters)</label>
      <input id={`${id}-pw`} name="password" type="password" minLength={12} required autoComplete="new-password" className={inputClass} />
      <label htmlFor={`${id}-confirm`} className="block text-sm font-medium">Confirm password</label>
      <input id={`${id}-confirm`} name="confirm" type="password" minLength={12} required autoComplete="new-password" className={inputClass} />
      <Button type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account and accept"}</Button>
    </form>
  );
}

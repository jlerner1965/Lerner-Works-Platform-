"use client";

import { useActionState, useId } from "react";
import { signInAction, type SignInState } from "@/server/auth/actions";

export function SignInForm({ next, recoveryHref }: { next?: string; recoveryHref?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, {});
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  return (
    <form action={action} className="rounded border border-line bg-surface p-6 shadow-sm" noValidate aria-describedby={state.error ? errorId : undefined}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? (
        <div id={errorId} role="alert" className="mb-4 rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      ) : null}
      <div className="mb-4">
        <label htmlFor={emailId} className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.values?.email ?? ""}
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          aria-describedby={state.fieldErrors?.email ? `${emailId}-error` : undefined}
          className="w-full rounded border border-line-strong px-3 py-2 text-base"
        />
        {state.fieldErrors?.email ? (
          <p id={`${emailId}-error`} className="mt-1 text-sm text-danger">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>
      <div className="mb-6">
        <label htmlFor={passwordId} className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.fieldErrors?.password ? true : undefined}
          aria-describedby={state.fieldErrors?.password ? `${passwordId}-error` : undefined}
          className="w-full rounded border border-line-strong px-3 py-2 text-base"
        />
        {state.fieldErrors?.password ? (
          <p id={`${passwordId}-error`} className="mt-1 text-sm text-danger">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-action px-4 py-2 font-medium text-white hover:bg-action-hover disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {recoveryHref ? (
        <p className="mt-4 text-center text-sm">
          <a href={recoveryHref} className="text-action underline">Forgot your password?</a>
        </p>
      ) : null}
    </form>
  );
}

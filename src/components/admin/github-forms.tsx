"use client";

import { useActionState, useId } from "react";
import { checkGithubSourceAction, forgetSourceAction, type SourceActionState } from "@/server/actions/sources";
import { removeGithubTokenAction, setGithubTokenAction, type SecretActionState } from "@/server/actions/secrets";
import { Alert, Button, inputClass } from "@/components/admin/ui";

export interface GithubSourceView {
  repository: string;
  branch: string;
  root: string | null;
}

/** Fetch a repository and check it like an upload (B8); prefilled with the site's remembered source. */
export function GithubSourceForm({ siteId, source }: { siteId: string; source: GithubSourceView | null }) {
  const [state, action, pending] = useActionState<SourceActionState, FormData>(checkGithubSourceAction, {});
  const id = useId();
  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="siteId" value={siteId} />
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <label htmlFor={`${id}-repository`} className="block">
        <span className="font-medium">Repository</span>
        <input id={`${id}-repository`} name="repository" defaultValue={source?.repository ?? ""} required className={`${inputClass} mt-1`} placeholder="owner/name or https://github.com/owner/name" maxLength={300} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={`${id}-branch`} className="block">
          <span className="font-medium">Branch</span>
          <input id={`${id}-branch`} name="branch" defaultValue={source?.branch ?? ""} className={`${inputClass} mt-1`} placeholder="the default branch" maxLength={200} />
        </label>
        <label htmlFor={`${id}-root`} className="block">
          <span className="font-medium">Folder (optional)</span>
          <input id={`${id}-root`} name="root" defaultValue={source?.root ?? ""} className={`${inputClass} mt-1`} placeholder="dist, docs…" maxLength={200} />
        </label>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Fetching from GitHub…" : source ? "Check the latest from GitHub" : "Fetch and check"}</Button>
      <p className="text-xs text-ink-subtle">The files of the repository at the latest commit of the branch are fetched here and checked like a ZIP; nothing changes on the site until you publish the check. Public repositories need nothing more; a private one needs the token stored for the organization (Organizations page).</p>
    </form>
  );
}

export function ForgetSourceForm({ siteId }: { siteId: string }) {
  const [state, action, pending] = useActionState<SourceActionState, FormData>(forgetSourceAction, {});
  return (
    <form action={action} className="text-xs">
      <input type="hidden" name="siteId" value={siteId} />
      {state.error ? <span className="text-danger">{state.error} </span> : null}
      <button type="submit" disabled={pending} className="text-ink-subtle underline">{pending ? "Forgetting…" : "Forget this source"}</button>
    </form>
  );
}

export interface TokenMetaView {
  last4: string;
  createdAt: string;
}

/** The organization's GitHub token (B8): paste one, or remove the stored one; never shown back. */
export function GithubTokenForm({ organizationId, meta }: { organizationId: string; meta: TokenMetaView | null }) {
  const [setState, setAction, setting] = useActionState<SecretActionState, FormData>(setGithubTokenAction, {});
  const [removeState, removeAction, removing] = useActionState<SecretActionState, FormData>(removeGithubTokenAction, {});
  const id = useId();
  const notice = setState.error || removeState.error ? <Alert tone="danger" role="alert">{setState.error ?? removeState.error}</Alert> : setState.ok || removeState.ok ? <Alert tone="success" role="status">{setState.ok ?? removeState.ok}</Alert> : null;
  return (
    <div className="space-y-2 text-sm">
      {notice}
      {meta ? (
        <form action={removeAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <span>A GitHub token ending in <code>…{meta.last4}</code> is stored (added {meta.createdAt}). Private repositories of the sites here are fetched with it.</span>
          <Button type="submit" variant="secondary" disabled={removing}>{removing ? "Removing…" : "Remove token"}</Button>
        </form>
      ) : (
        <form action={setAction} className="space-y-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <label htmlFor={`${id}-token`} className="block">
            <span className="font-medium">GitHub token for private repositories (optional)</span>
            <input id={`${id}-token`} name="token" type="password" autoComplete="off" required className={`${inputClass} mt-1 max-w-lg`} placeholder="github_pat_…" maxLength={400} />
          </label>
          <p className="text-xs text-ink-subtle">A fine-grained token with read access to Contents of the repositories you publish from. It is checked with GitHub, stored sealed, used only on the server and never shown again.</p>
          <Button type="submit" variant="secondary" disabled={setting}>{setting ? "Checking with GitHub…" : "Save token"}</Button>
        </form>
      )}
    </div>
  );
}

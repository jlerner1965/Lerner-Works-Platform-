"use client";

import { useActionState, useId } from "react";
import { createDeployTokenAction, revokeDeployTokenAction, type DeployTokenState } from "@/server/actions/deploy";
import { Alert, Button, inputClass } from "@/components/admin/ui";

export interface DeployTokenView {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Creates a deploy token (B9); the token is shown once with the CI step that uses it. */
export function CreateDeployTokenForm({ siteId, appUrl, folderHint }: { siteId: string; appUrl: string; folderHint: string }) {
  const [state, action, pending] = useActionState<DeployTokenState, FormData>(createDeployTokenAction, {});
  const id = useId();
  // The script defaults to the production address; another platform address is named in the step.
  const url = appUrl === "https://app.lernerworksplatform.dev" ? "" : `\n          LW_URL: ${appUrl}`;
  const step = `      - name: Publish to Lerner Works Platform
        env:
          LW_DEPLOY_TOKEN: \${{ secrets.LW_DEPLOY_TOKEN }}${url}
        run: curl -fsSO ${appUrl}/deploy.sh && bash deploy.sh ${folderHint}`;
  return (
    <div className="space-y-3 text-sm">
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      {state.token ? (
        <Alert tone="success" role="status" title="Token created; copy it now, it is not shown again">
          <p className="mt-1"><code className="break-all">{state.token}</code></p>
          <p className="mt-2">Add it to the repository as the secret <code>LW_DEPLOY_TOKEN</code> (Settings → Secrets and variables → Actions), then add this step to the job that builds the site, after the build:</p>
          <pre className="mt-2 overflow-auto rounded border border-line bg-surface p-2 text-xs">{step}</pre>
          <p className="mt-2 text-xs">The script zips the folder, sends it in parts, and the platform checks and publishes it as the next release. The step prints the version and the preview address.</p>
        </Alert>
      ) : null}
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="siteId" value={siteId} />
        <label htmlFor={`${id}-label`} className="block">
          <span className="font-medium">Label (optional)</span>
          <input id={`${id}-label`} name="label" className={`${inputClass} mt-1 max-w-xs`} placeholder="GitHub Actions" maxLength={80} />
        </label>
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create deploy token"}</Button>
      </form>
    </div>
  );
}

export function RevokeDeployTokenForm({ siteId, tokenId }: { siteId: string; tokenId: string }) {
  const [state, action, pending] = useActionState<DeployTokenState, FormData>(revokeDeployTokenAction, {});
  return (
    <form action={action} className="inline text-xs">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="tokenId" value={tokenId} />
      {state.error ? <span className="text-danger">{state.error} </span> : null}
      <button type="submit" disabled={pending} className="text-danger underline">{pending ? "Revoking…" : "Revoke"}</button>
    </form>
  );
}

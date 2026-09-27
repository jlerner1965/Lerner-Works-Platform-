"use client";

import { useActionState, useId, useState } from "react";
import { deleteOrganizationAction, deleteSiteAction, type RemovalState } from "@/server/actions/removal";
import { Alert, Button, inputClass } from "@/components/admin/ui";

/**
 * Removal (site-building programme B6): the owner types the site key or the organization name,
 * reads what goes and what stays, and presses a button that is disabled until the confirmation
 * matches. The rules are enforced again by the SQL functions.
 */

export interface RemovalCountsView {
  items: number;
  releases: number;
  media: number;
  inquiries: number;
  members: number;
  domains: number;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function describeSiteRemoval(counts: RemovalCountsView): string {
  return [plural(counts.items, "content item"), plural(counts.releases, "release"), plural(counts.media, "media file"), plural(counts.inquiries, "inquiry", "inquiries"), plural(counts.members, "site membership"), plural(counts.domains, "domain")].join(", ");
}

export function RemoveSiteForm({ siteId, siteKey, siteName, counts, blockedBy }: { siteId: string; siteKey: string; siteName: string; counts: RemovalCountsView; blockedBy: string | null }) {
  const [state, action, pending] = useActionState<RemovalState, FormData>(deleteSiteAction, {});
  const [typed, setTyped] = useState("");
  const id = useId();
  const matches = typed.trim() === siteKey;
  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="siteId" value={siteId} />
      <p className="text-ink-muted">
        Deleting <strong>{siteName}</strong> removes {describeSiteRemoval(counts)} and every published copy of its pictures and documents that no other site uses. The public address stops answering at once. The audit trail of the site stays in the organization&apos;s activity log. There is no undo: export the site package first if anything might be wanted again.
      </p>
      {blockedBy ? (
        <Alert tone="warning">{blockedBy}</Alert>
      ) : (
        <>
          {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
          <label htmlFor={`${id}-key`} className="block font-medium">
            Type the site key <code className="rounded bg-surface-raised px-1">{siteKey}</code> to confirm
          </label>
          <input id={`${id}-key`} name="confirmKey" className={inputClass} autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />
          <Button type="submit" variant="danger" disabled={!matches || pending}>{pending ? "Deleting…" : "Delete this site"}</Button>
        </>
      )}
    </form>
  );
}

export function RemoveOrganizationForm({ organizationId, name, sites, blockedBy }: { organizationId: string; name: string; sites: Array<{ id: string; key: string; name: string; mode: "demo" | "live" }>; blockedBy: string | null }) {
  const [state, action, pending] = useActionState<RemovalState, FormData>(deleteOrganizationAction, {});
  const [typed, setTyped] = useState("");
  const id = useId();
  const matches = typed.trim() === name;
  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="organizationId" value={organizationId} />
      <p className="text-ink-muted">
        Deleting <strong>{name}</strong> removes its memberships and open invitations and {sites.length === 0 ? "has no sites to remove" : `its ${plural(sites.length, "site")} with everything in them: content, releases, media files, inquiries and domains`}. Nobody keeps access to it afterwards; its activity log is kept in the database for the operator. There is no undo.
      </p>
      {sites.length ? (
        <ul className="list-disc pl-5">
          {sites.map((s) => (
            <li key={s.id}>
              {s.name} <code className="text-xs">{s.key}</code>{s.mode === "live" ? <span className="ml-1 text-danger"> (live on a domain)</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {blockedBy ? (
        <Alert tone="warning">{blockedBy}</Alert>
      ) : (
        <>
          {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
          <label htmlFor={`${id}-name`} className="block font-medium">
            Type the organization name <code className="rounded bg-surface-raised px-1">{name}</code> to confirm
          </label>
          <input id={`${id}-name`} name="confirmName" className={inputClass} autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />
          <Button type="submit" variant="danger" disabled={!matches || pending}>{pending ? "Deleting…" : `Delete this organization${sites.length ? ` and its ${plural(sites.length, "site")}` : ""}`}</Button>
        </>
      )}
    </form>
  );
}

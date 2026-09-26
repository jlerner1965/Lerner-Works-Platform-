"use client";

import { useActionState } from "react";
import { domainAction, setSiteModeAction, type DomainActionState, type SiteModeState } from "@/server/actions/domains";
import type { DomainProviderStatus } from "@/server/domains/provider";
import { Alert, Badge, Button } from "@/components/admin/ui";

export interface DomainView {
  id: string;
  host: string;
  status: "pending" | "verifying" | "active" | "disabled";
  isCanonical: boolean;
  verifiedAt: string | null;
  provider: DomainProviderStatus | null;
}

const statusTone = { pending: "neutral", verifying: "warning", active: "success", disabled: "danger" } as const;

function Records({ title, records }: { title: string; records: DomainProviderStatus["verification"] }) {
  if (!records.length) return null;
  return (
    <div className="mt-2">
      <p className="text-xs font-medium">{title}</p>
      <table className="mt-1 w-full text-xs">
        <thead><tr className="text-left text-ink-subtle"><th className="pr-2">Type</th><th className="pr-2">Name</th><th>Value</th></tr></thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} className="border-t border-line align-top">
              <td className="py-0.5 pr-2"><code>{r.type}</code></td>
              <td className="py-0.5 pr-2 break-all"><code>{r.name}</code></td>
              <td className="py-0.5 break-all"><code>{r.value}</code>{r.reason ? <span className="text-ink-subtle"> · {r.reason}</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DomainRow({ siteId, domain, providerConfigured, siteMode, canManage }: { siteId: string; domain: DomainView; providerConfigured: boolean; siteMode: "demo" | "live"; canManage: boolean }) {
  const [state, action, pending] = useActionState<DomainActionState, FormData>(domainAction, {});
  const p = domain.provider;
  const canActivate = domain.verifiedAt !== null && domain.status !== "active" && domain.status !== "disabled";
  return (
    <li className="py-3">
      <form action={action} className="space-y-2 text-sm">
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="domainId" value={domain.id} />
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-base">{domain.host}</code>
          <Badge tone={statusTone[domain.status]}>{domain.status}</Badge>
          {domain.isCanonical ? <Badge tone="info">canonical</Badge> : null}
          {domain.verifiedAt ? <Badge tone="success">verified</Badge> : <Badge tone="neutral">not verified</Badge>}
        </div>
        {state.message ? <Alert tone="success" role="status">{state.message}</Alert> : null}
        {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
        {p ? (
          <div className="rounded border border-line bg-surface-muted p-2 text-xs">
            <p>
              Provider {p.provider}: {p.registered ? "registered" : "not registered"} · ownership {p.verified ? "verified" : "not verified"} · DNS {p.configured === null ? "unknown" : p.configured ? `configured${p.configuredBy ? ` (${p.configuredBy})` : ""}` : "not configured"} · checked {new Date(p.checkedAt).toUTCString()}
            </p>
            {p.note ? <p className="mt-1 text-ink-subtle">{p.note}</p> : null}
            <Records title="Verification record required by the provider" records={p.verification} />
            <Records title="DNS records the provider recommends" records={p.recommended} />
          </div>
        ) : (
          <p className="text-xs text-ink-subtle">{providerConfigured ? "Not registered with the hosting provider yet." : "No hosting provider is configured in this environment; verification is only possible in the hosted deployment."}</p>
        )}
        {canManage ? <div className="flex flex-wrap gap-2">
          {domain.status === "pending" && providerConfigured ? <Button type="submit" name="intent" value="register" variant="secondary" disabled={pending}>Register with hosting provider</Button> : null}
          {domain.status !== "pending" && providerConfigured ? <Button type="submit" name="intent" value="check" variant="secondary" disabled={pending}>Check verification</Button> : null}
          {canActivate ? <Button type="submit" name="intent" value="activate" disabled={pending}>Activate</Button> : null}
          {domain.status === "active" ? <Button type="submit" name="intent" value="disable" variant="secondary" disabled={pending || (domain.isCanonical && siteMode === "live")}>Disable</Button> : null}
          {!domain.isCanonical && domain.status !== "disabled" ? <Button type="submit" name="intent" value="canonical" variant="ghost" disabled={pending}>Make canonical</Button> : null}
          {domain.status !== "active" ? <Button type="submit" name="intent" value="remove" variant="ghost" disabled={pending}>Remove</Button> : null}
        </div> : null}
        {domain.isCanonical && siteMode === "live" && domain.status === "active" ? <p className="text-xs text-ink-subtle">The canonical domain of a live site cannot be disabled; make another domain canonical or return the site to demonstration mode first.</p> : null}
      </form>
    </li>
  );
}

export function SiteModeForm({ siteId, mode, hasRelease, hasCanonicalDomain, demoUrl, liveUrl }: { siteId: string; mode: "demo" | "live"; hasRelease: boolean; hasCanonicalDomain: boolean; demoUrl: string; liveUrl: string | null }) {
  const [state, action, pending] = useActionState<SiteModeState, FormData>(setSiteModeAction, {});
  const ready = hasRelease && hasCanonicalDomain;
  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="siteId" value={siteId} />
      {state.message ? <Alert tone="success" role="status">{state.message}</Alert> : null}
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <p>Current mode: <Badge tone={mode === "live" ? "success" : "warning"}>{mode}</Badge> {mode === "live" ? <>Served at <code>{liveUrl ?? "(no canonical domain)"}</code>; the demonstration route returns 404.</> : <>Served at <code>{demoUrl}</code> only; registered domains return 404 until the site goes live.</>}</p>
      <ul className="space-y-1">
        <li className="flex items-center gap-2"><Badge tone={hasRelease ? "success" : "danger"}>{hasRelease ? "done" : "missing"}</Badge> An active release exists.</li>
        <li className="flex items-center gap-2"><Badge tone={hasCanonicalDomain ? "success" : "danger"}>{hasCanonicalDomain ? "done" : "missing"}</Badge> A verified, active canonical domain exists.</li>
      </ul>
      {mode === "demo" ? (
        <Button type="submit" name="mode" value="live" disabled={pending || !ready}>Go live</Button>
      ) : (
        <Button type="submit" name="mode" value="demo" variant="secondary" disabled={pending}>Return to demonstration mode</Button>
      )}
      <p className="text-xs text-ink-subtle">Going live changes where the current release is served; it publishes nothing new. Content changes still go through candidate → activate.</p>
    </form>
  );
}

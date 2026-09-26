"use client";

import { useActionState, useState } from "react";
import { createSiteAction, type CreateSiteState } from "@/server/actions/sites";
import { Alert, Button, Field, inputClass, selectClass } from "@/components/admin/ui";
import { slugify } from "@/lib/slug";

export function CreateSiteForm({ organizations, presets }: { organizations: Array<{ id: string; name: string }>; presets: Array<{ key: string; label: string; description: string; defaultTimeZone: string }> }) {
  const [state, action, pending] = useActionState<CreateSiteState, FormData>(createSiteAction, {});
  const v = state.values ?? {};
  const [org, setOrg] = useState(v.organizationId ?? organizations[0]?.id ?? "new");
  const [name, setName] = useState(v.name ?? "");
  const [key, setKey] = useState(v.key ?? "");
  const [keyTouched, setKeyTouched] = useState(Boolean(v.key));
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-2xl space-y-6">
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <fieldset className="rounded border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Organization</legend>
        <Field label="Organization" htmlFor="organizationId" required error={e.organizationId}>
          <select id="organizationId" name="organizationId" value={org} onChange={(ev) => setOrg(ev.target.value)} className={selectClass}>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            <option value="new">Create a new organization…</option>
          </select>
        </Field>
        {org === "new" ? (
          <Field label="New organization name" htmlFor="newOrganizationName" required error={e.newOrganizationName}>
            <input id="newOrganizationName" name="newOrganizationName" defaultValue={v.newOrganizationName ?? ""} className={inputClass} />
          </Field>
        ) : null}
      </fieldset>
      <fieldset className="rounded border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Preset</legend>
        {presets.map((p) => (
          <label key={p.key} className="mb-2 flex items-start gap-2 text-sm">
            <input type="radio" name="preset" value={p.key} defaultChecked={(v.preset ?? presets[0]?.key) === p.key} className="mt-1" />
            <span><span className="font-medium">{p.label}</span><br /><span className="text-ink-muted">{p.description}</span></span>
          </label>
        ))}
        {e.preset ? <p className="text-sm text-danger">{e.preset}</p> : null}
      </fieldset>
      <fieldset className="rounded border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Identity</legend>
        <Field label="Site name" htmlFor="name" required error={e.name}>
          <input id="name" name="name" value={name} onChange={(ev) => { setName(ev.target.value); if (!keyTouched) setKey(slugify(ev.target.value)); }} className={inputClass} />
        </Field>
        <Field label="Internal key" htmlFor="key" required error={e.key} hint="Unique registry key used in local demonstration URLs (/demo/<key>). Lowercase letters, numbers, hyphens.">
          <input id="key" name="key" value={key} onChange={(ev) => { setKeyTouched(true); setKey(ev.target.value); }} className={inputClass} />
        </Field>
        <Field label="Time zone" htmlFor="timeZone" required error={e.timeZone} hint="IANA name, e.g. America/Denver.">
          <input id="timeZone" name="timeZone" defaultValue={v.timeZone ?? presets[0]?.defaultTimeZone ?? "America/Denver"} className={inputClass} />
        </Field>
        <Field label="Mode" htmlFor="mode" required>
          <select id="mode" name="mode" defaultValue={v.mode ?? "demo"} className={selectClass}>
            <option value="demo">Demonstration (served at /demo/&lt;key&gt; with a visible demo label)</option>
            <option value="live">Live (served only on a verified domain)</option>
          </select>
        </Field>
      </fieldset>
      <fieldset className="rounded border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Default contact information</legend>
        <Field label="Contact email" htmlFor="contactEmail" error={e.contactEmail}><input id="contactEmail" name="contactEmail" type="email" defaultValue={v.contactEmail ?? ""} className={inputClass} /></Field>
        <Field label="Contact phone" htmlFor="contactPhone"><input id="contactPhone" name="contactPhone" defaultValue={v.contactPhone ?? ""} className={inputClass} /></Field>
        <Field label="Contact address" htmlFor="contactAddress"><input id="contactAddress" name="contactAddress" defaultValue={v.contactAddress ?? ""} className={inputClass} /></Field>
        <Field label="Inquiry notification recipients" htmlFor="inquiryRecipients" error={e.inquiryRecipients} hint="Comma-separated email addresses that receive inquiry notifications. Stored server-side; visitors can never choose recipients.">
          <input id="inquiryRecipients" name="inquiryRecipients" defaultValue={v.inquiryRecipients ?? ""} className={inputClass} />
        </Field>
      </fieldset>
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create site"}</Button>
    </form>
  );
}

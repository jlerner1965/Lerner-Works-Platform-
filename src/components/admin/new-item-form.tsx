"use client";

import { useActionState, useState } from "react";
import { createItemAction, type CreateItemState } from "@/server/actions/content";
import { Button, Field, inputClass, selectClass } from "@/components/admin/ui";
import { slugify } from "@/lib/slug";

export function NewItemForm({ siteId, kinds, initialKind }: { siteId: string; kinds: Array<{ kind: string; label: string; plural: string }>; initialKind: string }) {
  const [state, action, pending] = useActionState<CreateItemState, FormData>(createItemAction, {});
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  return (
    <form action={action} className="max-w-lg rounded border border-line bg-surface p-4">
      <input type="hidden" name="siteId" value={siteId} />
      {state.error ? <p role="alert" className="mb-3 rounded bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <Field label="Type" htmlFor="kind" required>
        <select id="kind" name="kind" defaultValue={initialKind} className={selectClass}>
          {kinds.map((k) => (
            <option key={k.kind} value={k.kind}>{k.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Title" htmlFor="title" required error={state.fieldErrors?.title}>
        <input id="title" name="title" required className={inputClass} value={title} onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} aria-invalid={state.fieldErrors?.title ? true : undefined} />
      </Field>
      <Field label="Slug" htmlFor="slug" hint="Part of the public address. Lowercase letters, numbers and hyphens." error={state.fieldErrors?.slug}>
        <input id="slug" name="slug" className={inputClass} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} aria-invalid={state.fieldErrors?.slug ? true : undefined} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create draft"}</Button>
    </form>
  );
}

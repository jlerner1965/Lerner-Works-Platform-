"use client";

import { useActionState, useId, useState } from "react";
import { createItemAction, type CreateItemState } from "@/server/actions/content";
import { Button, Field, inputClass, selectClass } from "@/components/admin/ui";
import { slugify } from "@/lib/slug";

/** Category field for places with the site's existing categories as suggestions (typed freely, reused for consistency). */
function CategoryField({ categories, error, defaultValue = "" }: { categories: string[]; error?: string; defaultValue?: string }) {
  const id = useId();
  return (
    <Field label="Category" htmlFor={`${id}-category`} required error={error} hint={categories.length ? "Reuse an existing category or type a new one." : "Visitors filter the directory by category."}>
      <input id={`${id}-category`} name="category" required list={`${id}-categories`} defaultValue={defaultValue} className={inputClass} maxLength={60} aria-invalid={error ? true : undefined} autoComplete="off" />
      <datalist id={`${id}-categories`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
    </Field>
  );
}

export function NewItemForm({ siteId, kinds, initialKind, categories }: { siteId: string; kinds: Array<{ kind: string; label: string; plural: string }>; initialKind: string; categories: string[] }) {
  const [state, action, pending] = useActionState<CreateItemState, FormData>(createItemAction, {});
  const [kind, setKind] = useState(initialKind);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  return (
    <form action={action} className="max-w-lg rounded border border-line bg-surface p-4">
      <input type="hidden" name="siteId" value={siteId} />
      {state.error ? <p role="alert" className="mb-3 rounded bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <Field label="Type" htmlFor="kind" required>
        <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={selectClass}>
          {kinds.map((k) => (
            <option key={k.kind} value={k.kind}>{k.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Title" htmlFor="title" required error={state.fieldErrors?.title}>
        <input id="title" name="title" required className={inputClass} value={title} onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} aria-invalid={state.fieldErrors?.title ? true : undefined} />
      </Field>
      {kind === "place" ? <CategoryField categories={categories} error={state.fieldErrors?.category} /> : null}
      <Field label="Slug" htmlFor="slug" hint="Part of the public address. Lowercase letters, numbers and hyphens." error={state.fieldErrors?.slug}>
        <input id="slug" name="slug" className={inputClass} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} aria-invalid={state.fieldErrors?.slug ? true : undefined} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create draft"}</Button>
    </form>
  );
}

/**
 * Quick add on a content list (site-building programme B2): a title (and a category for
 * places) creates the draft with the site's defaults and opens the editor, one screen fewer
 * than the New item page.
 */
export function QuickAddForm({ siteId, kind, label, categories }: { siteId: string; kind: string; label: string; categories: string[] }) {
  const [state, action, pending] = useActionState<CreateItemState, FormData>(createItemAction, {});
  const id = useId();
  return (
    <form action={action} className="mb-4 rounded border border-line bg-surface p-3 text-sm" aria-labelledby={`${id}-legend`}>
      <p id={`${id}-legend`} className="mb-2 font-medium">Add a {label.toLowerCase()}</p>
      {state.error ? <p role="alert" className="mb-2 rounded bg-danger-soft px-3 py-2 text-danger">{state.error}</p> : null}
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="kind" value={kind} />
      <div className={`grid gap-3 ${kind === "place" ? "sm:grid-cols-[2fr_1fr_auto]" : "sm:grid-cols-[1fr_auto]"} sm:items-end`}>
        <Field label="Title" htmlFor={`${id}-title`} required error={state.fieldErrors?.title ?? state.fieldErrors?.slug}>
          <input id={`${id}-title`} name="title" required className={inputClass} maxLength={200} aria-invalid={state.fieldErrors?.title ? true : undefined} />
        </Field>
        {kind === "place" ? <CategoryField categories={categories} error={state.fieldErrors?.category} /> : null}
        <div className="mb-3"><Button type="submit" disabled={pending}>{pending ? "Adding…" : `Add ${label.toLowerCase()}`}</Button></div>
      </div>
      <p className="text-xs text-ink-subtle">Opens the editor for the details. The slug comes from the title; the rest takes the site&apos;s defaults.</p>
    </form>
  );
}

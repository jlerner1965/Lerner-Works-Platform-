"use client";

import type { PageSection, SectionType } from "@/modules/page";
import { sectionTypeLabels } from "@/modules/page";
import type { EditorContext, Issues } from "@/components/admin/editor/types";
import { TextInput, TextArea, SelectInput, Checkbox, MultiSelect } from "@/components/admin/editor/inputs";
import { BodyEditor } from "@/components/admin/editor/body-editor";
import { MediaPicker } from "@/components/admin/editor/media-picker";
import { Button } from "@/components/admin/ui";
import type { Block } from "@/lib/richtext";

function newId(): string {
  return `s-${Math.random().toString(36).slice(2, 10)}`;
}

export function newSection(type: SectionType): PageSection {
  const id = newId();
  switch (type) {
    case "text_hero":
      return { id, type, heading: "Heading", subheading: "", ctaLabel: "", ctaPath: "" };
    case "image_hero":
      return { id, type, heading: "Heading", subheading: "", imageAssetId: null, ctaLabel: "", ctaPath: "" };
    case "rich_text":
      return { id, type, heading: "", body: [] };
    case "feature_list":
      return { id, type, heading: "", items: [] };
    case "content_collection":
      return { id, type, heading: "", kind: "place", mode: "latest", itemIds: [], limit: 6 };
    case "location_collection":
      return { id, type, heading: "", mode: "all", itemIds: [] };
    case "contact_callout":
      return { id, type, heading: "Get in touch", text: "", showContactDetails: true };
    case "inquiry_form":
      return { id, type, heading: "Send an inquiry", intro: "", locationSelect: false };
  }
}

export function SectionsEditor({ sections, onChange, ctx, issues, allowedTypes }: { sections: PageSection[]; onChange: (s: PageSection[]) => void; ctx: EditorContext; issues: Issues; allowedTypes: SectionType[] }) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = sections.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const update = (i: number, s: PageSection) => onChange(sections.map((x, k) => (k === i ? s : x)));
  return (
    <div>
      <ol className="space-y-3">
        {sections.map((s, i) => (
          <li key={s.id} className="rounded border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-muted px-3 py-2 text-sm">
              <span className="font-semibold">{i + 1}. {sectionTypeLabels[s.type]}</span>
              <span className="ml-auto flex gap-1">
                <Button type="button" variant="secondary" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move section ${i + 1} up`}>Move up</Button>
                <Button type="button" variant="secondary" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={`Move section ${i + 1} down`}>Move down</Button>
                <Button type="button" variant="danger" onClick={() => onChange(sections.filter((_, k) => k !== i))} aria-label={`Remove section ${i + 1}`}>Remove</Button>
              </span>
            </div>
            <div className="p-3">
              <SectionFields section={s} onChange={(next) => update(i, next)} ctx={ctx} prefix={`sections.${i}`} issues={issues} />
            </div>
          </li>
        ))}
      </ol>
      {sections.length === 0 ? <p className="text-sm text-ink-subtle">This page has no sections yet.</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="add-section" className="font-medium">Add section</label>
        <select
          id="add-section"
          className="rounded border border-line-strong px-2 py-1"
          defaultValue=""
          onChange={(e) => {
            const t = e.target.value as SectionType | "";
            if (t) onChange([...sections, newSection(t)]);
            e.target.value = "";
          }}
        >
          <option value="">Choose a type…</option>
          {allowedTypes.map((t) => (
            <option key={t} value={t}>{sectionTypeLabels[t]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SectionFields({ section, onChange, ctx, prefix, issues }: { section: PageSection; onChange: (s: PageSection) => void; ctx: EditorContext; prefix: string; issues: Issues }) {
  const err = (f: string) => issues[`${prefix}.${f}`];
  switch (section.type) {
    case "text_hero":
    case "image_hero":
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} required error={err("heading")} />
          <TextArea label="Subheading" value={section.subheading} onChange={(v) => onChange({ ...section, subheading: v })} rows={2} error={err("subheading")} />
          {section.type === "image_hero" ? <MediaPicker label="Hero image" value={section.imageAssetId} onChange={(v) => onChange({ ...section, imageAssetId: v })} assets={ctx.assets} siteId={ctx.siteId} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Call to action label" value={section.ctaLabel} onChange={(v) => onChange({ ...section, ctaLabel: v })} error={err("ctaLabel")} />
            <TextInput label="Call to action path" value={section.ctaPath} onChange={(v) => onChange({ ...section, ctaPath: v })} hint={`Site-relative, e.g. ${ctx.routes.slice(0, 3).join(", ")}`} error={err("ctaPath")} />
          </div>
        </>
      );
    case "rich_text":
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <BodyEditor label="Text" blocks={section.body as Block[]} onChange={(b) => onChange({ ...section, body: b })} error={err("body")} rows={8} />
        </>
      );
    case "feature_list":
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <ul className="space-y-2">
            {section.items.map((item, i) => (
              <li key={i} className="rounded border border-line p-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  <TextInput label="Title" value={item.title} onChange={(v) => onChange({ ...section, items: section.items.map((x, k) => (k === i ? { ...x, title: v } : x)) })} required error={err(`items.${i}.title`)} />
                  <TextInput label="Text" value={item.text} onChange={(v) => onChange({ ...section, items: section.items.map((x, k) => (k === i ? { ...x, text: v } : x)) })} />
                  <TextInput label="Path" value={item.path} onChange={(v) => onChange({ ...section, items: section.items.map((x, k) => (k === i ? { ...x, path: v } : x)) })} error={err(`items.${i}.path`)} />
                </div>
                <button type="button" className="text-xs text-danger underline" onClick={() => onChange({ ...section, items: section.items.filter((_, k) => k !== i) })}>Remove item</button>
              </li>
            ))}
          </ul>
          {section.items.length < 12 ? <button type="button" className="mt-2 text-sm text-action underline" onClick={() => onChange({ ...section, items: [...section.items, { title: "", text: "", path: "" }] })}>Add item</button> : null}
        </>
      );
    case "content_collection": {
      const options = (ctx.related[section.kind] ?? []).map((r) => ({ value: r.id, label: r.title }));
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectInput label="Content type" value={section.kind} onChange={(v) => onChange({ ...section, kind: v as typeof section.kind, itemIds: [] })} options={[{ value: "place", label: "Places" }, { value: "event", label: "Events" }, { value: "article", label: "Articles" }, { value: "service", label: "Services" }]} />
            <SelectInput label="Selection" value={section.mode} onChange={(v) => onChange({ ...section, mode: v as typeof section.mode })} options={[{ value: "latest", label: "Latest / all" }, { value: "upcoming", label: "Upcoming (events)" }, { value: "selected", label: "Selected items" }]} />
            <TextInput label="Limit" type="number" value={String(section.limit)} onChange={(v) => onChange({ ...section, limit: Math.max(1, Math.min(24, Number(v) || 1)) })} />
          </div>
          {section.mode === "selected" ? <MultiSelect label="Selected items (same site only)" values={section.itemIds} onChange={(v) => onChange({ ...section, itemIds: v })} options={options} error={err("itemIds")} /> : null}
        </>
      );
    }
    case "location_collection": {
      const options = (ctx.related.store ?? []).map((r) => ({ value: r.id, label: r.title }));
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <SelectInput label="Selection" value={section.mode} onChange={(v) => onChange({ ...section, mode: v as typeof section.mode })} options={[{ value: "all", label: "All published stores" }, { value: "selected", label: "Selected stores (featured)" }]} />
          {section.mode === "selected" ? <MultiSelect label="Stores" values={section.itemIds} onChange={(v) => onChange({ ...section, itemIds: v })} options={options} error={err("itemIds")} /> : null}
        </>
      );
    }
    case "contact_callout":
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} required error={err("heading")} />
          <TextArea label="Text" value={section.text} onChange={(v) => onChange({ ...section, text: v })} rows={2} />
          <Checkbox label="Show the site's contact details" checked={section.showContactDetails} onChange={(v) => onChange({ ...section, showContactDetails: v })} />
        </>
      );
    case "inquiry_form":
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <TextArea label="Intro" value={section.intro} onChange={(v) => onChange({ ...section, intro: v })} rows={2} />
          <Checkbox label="Let visitors pick a location (store or place)" checked={section.locationSelect} onChange={(v) => onChange({ ...section, locationSelect: v })} />
        </>
      );
  }
}

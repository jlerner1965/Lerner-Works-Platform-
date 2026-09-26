"use client";

import type { PageSection, SectionType, SectionAppearance } from "@/modules/page";
import { sectionTypeLabels, emptySection, variantLabels, backgroundLabels, sectionBackgrounds, sectionAligns, sectionWidths, videoProviders, mapProviders, mapEmbedProviders, bandTints, bandStrengths, bandTintLabels, bandStrengthLabels } from "@/modules/page";
import type { EditorContext, Issues } from "@/components/admin/editor/types";
import { TextInput, TextArea, SelectInput, Checkbox, MultiSelect } from "@/components/admin/editor/inputs";
import { BodyEditor } from "@/components/admin/editor/body-editor";
import { MediaPicker } from "@/components/admin/editor/media-picker";
import { AddressFields } from "@/components/admin/editor/address-fields";
import { Button } from "@/components/admin/ui";
import type { Block } from "@/lib/richtext";
import type { ThemeCapabilities } from "@/themes/capabilities";

function newId(): string {
  return `s-${Math.random().toString(36).slice(2, 10)}`;
}

export function newSection(type: SectionType): PageSection {
  return emptySection(type, newId());
}

const kindPlural: Record<string, string> = { place: "places", event: "events", article: "articles", service: "services" };

/**
 * What a slot still needs, shown under its title. A section with nothing to show is left out
 * of the public page (B2, D-021); the hint says so, and says what fills the slot.
 */
export function slotHint(section: PageSection): string | null {
  switch (section.type) {
    case "rich_text":
      return section.body.length ? null : "Nothing to show yet: write the text, or remove the section. It is left out of the public page until it has text.";
    case "feature_list":
      return section.items.length ? null : "Nothing to show yet: add items. The section is left out of the public page until it has some.";
    case "faq":
    case "quotes":
    case "facts":
    case "gallery":
    case "team":
    case "logo_strip":
    case "image_text":
      return section.items.length ? null : "Nothing to show yet: add items, or remove the section. Publication needs at least one.";
    case "image_band":
      return section.heading || section.text || section.imageAssetId ? null : "Nothing to show yet: choose a picture or write a heading. The band is left out of the public page until it has one.";
    case "content_collection":
      if (section.mode === "selected") return section.itemIds.length ? null : "No items chosen: the section is left out of the public page until some are.";
      return `Fills itself with the published ${kindPlural[section.kind] ?? section.kind}${section.mode === "upcoming" ? " that are upcoming" : ""}; it is left out of the public page while there are none.`;
    case "location_collection":
      if (section.mode === "selected") return section.itemIds.length ? null : "No stores chosen: the section is left out of the public page until some are.";
      return "Fills itself with the published stores; it is left out of the public page while there are none.";
    case "category_list":
      return "Fills itself with the categories of the published places; it is left out of the public page while there are none.";
    case "image_hero":
      return section.imageAssetId ? null : "No image chosen: the heading and text stand on their own until one is.";
    case "video":
      return section.videoId ? null : "No video yet: the section is left out of the public page until one is chosen.";
    case "map_link":
      return section.address.line1 || section.address.locality ? null : "No address yet: the section is left out of the public page until one is entered.";
    default:
      return null;
  }
}

const alignLabels: Record<(typeof sectionAligns)[number], string> = { start: "Left", center: "Centred" };
const widthLabels: Record<(typeof sectionWidths)[number], string> = { default: "Usual for this section", narrow: "Narrow (reading width)", wide: "Full page width" };
const columnOptions = [{ value: "", label: "Theme default" }, { value: "2", label: "2 columns" }, { value: "3", label: "3 columns" }, { value: "4", label: "4 columns" }];

export function SectionsEditor({ sections, onChange, ctx, issues, capabilities }: { sections: PageSection[]; onChange: (s: PageSection[]) => void; ctx: EditorContext; issues: Issues; capabilities: ThemeCapabilities }) {
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
              {slotHint(s) ? <span className="basis-full text-xs text-ink-subtle sm:basis-auto">{slotHint(s)}</span> : null}
              <span className="ml-auto flex gap-1">
                <Button type="button" variant="secondary" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move section ${i + 1} up`}>Move up</Button>
                <Button type="button" variant="secondary" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={`Move section ${i + 1} down`}>Move down</Button>
                <Button type="button" variant="danger" onClick={() => onChange(sections.filter((_, k) => k !== i))} aria-label={`Remove section ${i + 1}`}>Remove</Button>
              </span>
            </div>
            <div className="p-3">
              <AppearanceControls section={s} onChange={(next) => update(i, next)} capabilities={capabilities} prefix={`sections.${i}`} issues={issues} />
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
          {capabilities.sectionTypes.map((t) => (
            <option key={t} value={t}>{sectionTypeLabels[t]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Style (variant) and appearance controls shared by every section type; only the theme's choices are offered. */
function AppearanceControls({ section, onChange, capabilities, prefix, issues }: { section: PageSection; onChange: (s: PageSection) => void; capabilities: ThemeCapabilities; prefix: string; issues: Issues }) {
  const variants = capabilities.variants[section.type];
  const app: SectionAppearance = section.appearance;
  const setApp = (patch: Partial<SectionAppearance>) => onChange({ ...section, appearance: { ...app, ...patch } } as PageSection);
  const unsupported = !variants.includes(section.variant);
  return (
    <div className="mb-3 grid gap-x-3 rounded border border-line bg-surface-muted p-2 sm:grid-cols-4">
      <SelectInput
        label="Style"
        value={section.variant}
        onChange={(v) => onChange({ ...section, variant: v } as PageSection)}
        options={[...variants.map((v) => ({ value: v, label: variantLabels[v] ?? v })), ...(unsupported ? [{ value: section.variant, label: `${variantLabels[section.variant] ?? section.variant} (not offered by this theme)` }] : [])]}
        error={issues[`${prefix}.variant`] ?? (unsupported ? `The ${capabilities.label} theme does not offer this style; choose another before saving.` : undefined)}
      />
      {section.type === "image_band" ? (
        <p className="mb-3 self-end text-xs text-ink-subtle">The band takes its colour from the wash chosen below.</p>
      ) : (
        <SelectInput label="Background" value={app.background} onChange={(v) => setApp({ background: v as SectionAppearance["background"] })} options={sectionBackgrounds.map((b) => ({ value: b, label: backgroundLabels[b] }))} />
      )}
      <SelectInput label="Alignment" value={app.align} onChange={(v) => setApp({ align: v as SectionAppearance["align"] })} options={sectionAligns.map((a) => ({ value: a, label: alignLabels[a] }))} />
      <SelectInput label="Width" value={app.width} onChange={(v) => setApp({ width: v as SectionAppearance["width"] })} options={sectionWidths.map((w) => ({ value: w, label: widthLabels[w] }))} />
    </div>
  );
}

function ItemList<T>({ items, render, onChange, empty, addLabel, max, blank }: { items: T[]; render: (item: T, update: (next: T) => void, i: number) => React.ReactNode; onChange: (items: T[]) => void; empty: string; addLabel: string; max: number; blank: () => T }) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <>
      {items.length === 0 ? <p className="mb-2 text-xs text-ink-subtle">{empty}</p> : null}
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="rounded border border-line p-2">
            {render(item, (next) => onChange(items.map((x, k) => (k === i ? next : x))), i)}
            <div className="flex flex-wrap gap-3 text-xs">
              <button type="button" className="text-action underline disabled:opacity-40" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move item ${i + 1} up`}>Move up</button>
              <button type="button" className="text-action underline disabled:opacity-40" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move item ${i + 1} down`}>Move down</button>
              <button type="button" className="text-danger underline" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label={`Remove item ${i + 1}`}>Remove item</button>
            </div>
          </li>
        ))}
      </ul>
      {items.length < max ? <button type="button" className="mt-2 text-sm text-action underline" onClick={() => onChange([...items, blank()])}>{addLabel}</button> : null}
    </>
  );
}

function SectionFields({ section, onChange, ctx, prefix, issues }: { section: PageSection; onChange: (s: PageSection) => void; ctx: EditorContext; prefix: string; issues: Issues }) {
  const err = (f: string) => issues[`${prefix}.${f}`];
  const pathHint = `Site-relative, e.g. ${ctx.routes.slice(0, 3).join(", ")}`;
  switch (section.type) {
    case "text_hero":
    case "image_hero":
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} required error={err("heading")} />
          <TextArea label="Subheading" value={section.subheading} onChange={(v) => onChange({ ...section, subheading: v })} rows={2} error={err("subheading")} />
          {section.type === "image_hero" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <MediaPicker label="Hero image" value={section.imageAssetId} onChange={(v) => onChange({ ...section, imageAssetId: v })} assets={ctx.assets} siteId={ctx.siteId} />
                <SelectInput label="Overlay over the image (full-width style)" value={section.overlay} onChange={(v) => onChange({ ...section, overlay: v as typeof section.overlay })} options={[{ value: "light", label: "Light" }, { value: "medium", label: "Medium" }, { value: "strong", label: "Strong" }]} hint="Darkens the picture behind the text; medium or strong keeps the text readable." />
              </div>
              {section.variant === "collage" ? (
                <fieldset className="mb-3 rounded border border-line p-3">
                  <legend className="px-1 text-sm font-medium">More pictures for the collage</legend>
                  <p className="mb-2 text-xs text-ink-subtle">Up to three pictures shown with the hero image; the collage needs at least one to look like one.</p>
                  <ItemList
                    items={section.extraImageAssetIds ?? []}
                    onChange={(ids) => onChange({ ...section, extraImageAssetIds: ids })}
                    empty="No extra pictures yet."
                    addLabel="Add picture"
                    max={3}
                    blank={() => ""}
                    render={(id, update, i) => <MediaPicker label={`Picture ${i + 2}`} value={id || null} onChange={(v) => update(v ?? "")} assets={ctx.assets} siteId={ctx.siteId} />}
                  />
                </fieldset>
              ) : null}
            </>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Call to action label" value={section.ctaLabel} onChange={(v) => onChange({ ...section, ctaLabel: v })} error={err("ctaLabel")} />
            <TextInput label="Call to action path" value={section.ctaPath} onChange={(v) => onChange({ ...section, ctaPath: v })} hint={pathHint} error={err("ctaPath")} />
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
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
            <SelectInput label="Columns" value={section.columns ? String(section.columns) : ""} onChange={(v) => onChange({ ...section, columns: v ? (Number(v) as 2 | 3 | 4) : undefined })} options={columnOptions} />
          </div>
          <ItemList
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            empty="No items yet."
            addLabel="Add item"
            max={12}
            blank={() => ({ title: "", text: "", path: "" })}
            render={(item, update, i) => (
              <div className="grid gap-2 sm:grid-cols-3">
                <TextInput label="Title" value={item.title} onChange={(v) => update({ ...item, title: v })} required error={err(`items.${i}.title`)} />
                <TextInput label="Text" value={item.text} onChange={(v) => update({ ...item, text: v })} />
                <TextInput label="Path" value={item.path} onChange={(v) => update({ ...item, path: v })} error={err(`items.${i}.path`)} />
              </div>
            )}
          />
        </>
      );
    case "content_collection": {
      const options = (ctx.related[section.kind] ?? []).map((r) => ({ value: r.id, label: r.title }));
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <div className="grid gap-3 sm:grid-cols-4">
            <SelectInput label="Content type" value={section.kind} onChange={(v) => onChange({ ...section, kind: v as typeof section.kind, itemIds: [] })} options={[{ value: "place", label: "Places" }, { value: "event", label: "Events" }, { value: "article", label: "Articles" }, { value: "service", label: "Services" }]} />
            <SelectInput label="Selection" value={section.mode} onChange={(v) => onChange({ ...section, mode: v as typeof section.mode })} options={[{ value: "latest", label: "Latest / all" }, { value: "upcoming", label: "Upcoming (events)" }, { value: "selected", label: "Selected items" }]} />
            <TextInput label="Limit" type="number" value={String(section.limit)} onChange={(v) => onChange({ ...section, limit: Math.max(1, Math.min(24, Number(v) || 1)) })} />
            <SelectInput label="Columns (cards)" value={section.columns ? String(section.columns) : ""} onChange={(v) => onChange({ ...section, columns: v ? (Number(v) as 2 | 3 | 4) : undefined })} options={columnOptions} />
          </div>
          {section.mode === "selected" ? <MultiSelect label="Selected items (same site only)" values={section.itemIds} onChange={(v) => onChange({ ...section, itemIds: v })} options={options} error={err("itemIds")} /> : null}
        </>
      );
    }
    case "category_list":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_10rem]">
            <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
            <TextInput label="Limit" type="number" value={String(section.limit)} onChange={(v) => onChange({ ...section, limit: Math.max(1, Math.min(24, Number(v) || 1)) })} hint="Largest categories first." />
            <SelectInput label="Columns (grid)" value={section.columns ? String(section.columns) : ""} onChange={(v) => onChange({ ...section, columns: v ? (Number(v) as 2 | 3 | 4) : undefined })} options={columnOptions} />
          </div>
          <Checkbox label="Show how many places each category has" checked={section.showCounts} onChange={(v) => onChange({ ...section, showCounts: v })} />
        </>
      );
    case "location_collection": {
      const options = (ctx.related.store ?? []).map((r) => ({ value: r.id, label: r.title }));
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput label="Selection" value={section.mode} onChange={(v) => onChange({ ...section, mode: v as typeof section.mode })} options={[{ value: "all", label: "All published stores" }, { value: "selected", label: "Selected stores (featured)" }]} />
            <SelectInput label="Columns (cards)" value={section.columns ? String(section.columns) : ""} onChange={(v) => onChange({ ...section, columns: v ? (Number(v) as 2 | 3 | 4) : undefined })} options={columnOptions} />
          </div>
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
    case "faq":
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <ItemList
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            empty="No questions yet. Publication needs at least one."
            addLabel="Add question"
            max={30}
            blank={() => ({ question: "", answer: [] })}
            render={(item, update, i) => (
              <>
                <TextInput label="Question" value={item.question} onChange={(v) => update({ ...item, question: v })} required error={err(`items.${i}.question`)} />
                <BodyEditor label="Answer" blocks={item.answer as Block[]} onChange={(b) => update({ ...item, answer: b })} rows={3} error={err(`items.${i}.answer`)} />
              </>
            )}
          />
        </>
      );
    case "quotes":
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <ItemList
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            empty="No quotations yet. Each one needs the words and who said them."
            addLabel="Add quotation"
            max={12}
            blank={() => ({ text: "", attribution: "", role: "", assetId: null })}
            render={(item, update, i) => (
              <>
                <TextArea label="Quotation" value={item.text} onChange={(v) => update({ ...item, text: v })} rows={2} error={err(`items.${i}.text`)} />
                <div className="grid gap-2 sm:grid-cols-3">
                  <TextInput label="Who said it" value={item.attribution} onChange={(v) => update({ ...item, attribution: v })} required error={err(`items.${i}.attribution`)} />
                  <TextInput label="Their role or place (optional)" value={item.role} onChange={(v) => update({ ...item, role: v })} />
                  <MediaPicker label="Portrait (optional)" value={item.assetId ?? null} onChange={(v) => update({ ...item, assetId: v })} assets={ctx.assets} siteId={ctx.siteId} hint="Shown small beside the name; crops keep the focal point." />
                </div>
              </>
            )}
          />
        </>
      );
    case "cta_banner":
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} required error={err("heading")} />
          <TextArea label="Text" value={section.text} onChange={(v) => onChange({ ...section, text: v })} rows={2} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Button label" value={section.ctaLabel} onChange={(v) => onChange({ ...section, ctaLabel: v })} required error={err("ctaLabel")} />
            <TextInput label="Button link" value={section.ctaPath} onChange={(v) => onChange({ ...section, ctaPath: v })} hint="Site path or https:// address" error={err("ctaPath")} />
            <TextInput label="Second button label (optional)" value={section.secondaryLabel} onChange={(v) => onChange({ ...section, secondaryLabel: v })} error={err("secondaryLabel")} />
            <TextInput label="Second button link" value={section.secondaryPath} onChange={(v) => onChange({ ...section, secondaryPath: v })} error={err("secondaryPath")} />
          </div>
        </>
      );
    case "gallery":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem_12rem]">
            <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
            <SelectInput label="Columns" value={section.columns ? String(section.columns) : ""} onChange={(v) => onChange({ ...section, columns: v ? (Number(v) as 2 | 3 | 4) : undefined })} options={columnOptions} />
            <SelectInput label="Image shape" value={section.aspect} onChange={(v) => onChange({ ...section, aspect: v as typeof section.aspect })} options={[{ value: "landscape", label: "Landscape (4:3)" }, { value: "square", label: "Square" }, { value: "portrait", label: "Portrait (3:4)" }, { value: "natural", label: "As uploaded" }]} hint="Crops keep each image's focal point (set in Media)." />
          </div>
          <Checkbox label="Open each picture at full size when it is clicked" checked={section.lightbox ?? false} onChange={(v) => onChange({ ...section, lightbox: v })} hint="A lightbox drawn by the browser's own styles: no script is added to the page." />
          <ItemList
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            empty="No images yet. Publication needs at least one."
            addLabel="Add image"
            max={24}
            blank={() => ({ assetId: "", caption: "" })}
            render={(item, update, i) => (
              <div className="grid gap-2 sm:grid-cols-2">
                <MediaPicker label="Image" value={item.assetId || null} onChange={(v) => update({ ...item, assetId: v ?? "" })} assets={ctx.assets} siteId={ctx.siteId} />
                <TextInput label="Caption (optional)" value={item.caption} onChange={(v) => update({ ...item, caption: v })} error={err(`items.${i}.assetId`) ?? err(`items.${i}.caption`)} />
              </div>
            )}
          />
        </>
      );
    case "facts":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
            <SelectInput label="Columns" value={section.columns ? String(section.columns) : ""} onChange={(v) => onChange({ ...section, columns: v ? (Number(v) as 2 | 3 | 4) : undefined })} options={columnOptions} />
          </div>
          <ItemList
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            empty="No facts yet. Enter only facts you can stand behind; nothing is computed."
            addLabel="Add fact"
            max={24}
            blank={() => ({ label: "", value: "" })}
            render={(item, update, i) => (
              <div className="grid gap-2 sm:grid-cols-2">
                <TextInput label="Label" value={item.label} onChange={(v) => update({ ...item, label: v })} required error={err(`items.${i}.label`)} />
                <TextInput label="Value" value={item.value} onChange={(v) => update({ ...item, value: v })} required error={err(`items.${i}.value`)} />
              </div>
            )}
          />
        </>
      );
    case "video":
      return (
        <>
          <TextInput label="Heading (optional)" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput label="Provider" value={section.provider} onChange={(v) => onChange({ ...section, provider: v as (typeof videoProviders)[number] })} options={[{ value: "youtube", label: "YouTube (privacy-enhanced player)" }, { value: "vimeo", label: "Vimeo (do not track)" }]} />
            <TextInput label="Video id" value={section.videoId} onChange={(v) => onChange({ ...section, videoId: v })} required hint={section.provider === "youtube" ? "The 11 characters after v= in the video's address." : "The number at the end of the video's address."} error={err("videoId")} />
            <TextInput label="Video title" value={section.title} onChange={(v) => onChange({ ...section, title: v })} required hint="Read out to screen-reader users and shown when there is no poster." error={err("title")} />
            <MediaPicker label="Poster image" value={section.posterAssetId} onChange={(v) => onChange({ ...section, posterAssetId: v })} assets={ctx.assets} siteId={ctx.siteId} hint="Shown until the visitor presses play; nothing is loaded from the provider before that." />
          </div>
          <TextInput label="Caption (optional)" value={section.caption} onChange={(v) => onChange({ ...section, caption: v })} />
        </>
      );
    case "map_link":
      return (
        <>
          <TextInput label="Heading (optional)" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <TextArea label="Text (optional)" value={section.text} onChange={(v) => onChange({ ...section, text: v })} rows={2} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Button label" value={section.label} onChange={(v) => onChange({ ...section, label: v })} />
            <SelectInput label="Map provider" value={section.provider} onChange={(v) => onChange({ ...section, provider: v as (typeof mapProviders)[number] })} options={[{ value: "google", label: "Google Maps" }, { value: "apple", label: "Apple Maps" }, { value: "openstreetmap", label: "OpenStreetMap" }]} hint="Nothing is loaded from the provider until a visitor follows the link or asks for the map." />
          </div>
          <AddressFields value={section.address} onChange={(address) => onChange({ ...section, address })} issues={issues} prefix={`${prefix}.address`} />
          <Checkbox
            label="Offer the map on the page (loads only when the visitor asks for it)"
            checked={section.embed ?? false}
            onChange={(v) => onChange({ ...section, embed: v })}
            hint={mapEmbedProviders.includes(section.provider) ? "Visitors see the address on a plain panel with a \"Show map\" button; the provider's map loads only after they press it, and only where the directions link would appear." : "Apple Maps cannot be embedded: the button links out instead. Choose Google Maps or OpenStreetMap to offer a map on the page."}
          />
          {section.embed ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label="Latitude" type="number" value={section.latitude === null || section.latitude === undefined ? "" : String(section.latitude)} onChange={(v) => onChange({ ...section, latitude: v === "" || Number.isNaN(Number(v)) ? null : Number(v) })} required hint="Decimal degrees, e.g. 40.015 (north positive)." error={err("latitude")} />
              <TextInput label="Longitude" type="number" value={section.longitude === null || section.longitude === undefined ? "" : String(section.longitude)} onChange={(v) => onChange({ ...section, longitude: v === "" || Number.isNaN(Number(v)) ? null : Number(v) })} required hint="Decimal degrees, e.g. -105.27 (west negative)." error={err("longitude")} />
            </div>
          ) : null}
        </>
      );
    case "team":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
            <SelectInput label="Columns (grid)" value={section.columns ? String(section.columns) : ""} onChange={(v) => onChange({ ...section, columns: v ? (Number(v) as 2 | 3 | 4) : undefined })} options={columnOptions} />
          </div>
          <TextArea label="Introduction (optional)" value={section.intro} onChange={(v) => onChange({ ...section, intro: v })} rows={2} />
          <ItemList
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            empty="No people yet. Publication needs at least one."
            addLabel="Add person"
            max={24}
            blank={() => ({ name: "", role: "", text: "", assetId: null, path: "" })}
            render={(item, update, i) => (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  <TextInput label="Name" value={item.name} onChange={(v) => update({ ...item, name: v })} required error={err(`items.${i}.name`)} />
                  <TextInput label="Role (optional)" value={item.role} onChange={(v) => update({ ...item, role: v })} />
                  <MediaPicker label="Portrait (optional)" value={item.assetId ?? null} onChange={(v) => update({ ...item, assetId: v })} assets={ctx.assets} siteId={ctx.siteId} hint="Square crops keep the focal point set in Media." />
                </div>
                <TextArea label="A few words (optional)" value={item.text} onChange={(v) => update({ ...item, text: v })} rows={2} />
                <TextInput label="Link (optional)" value={item.path} onChange={(v) => update({ ...item, path: v })} hint="Site path or https:// address" error={err(`items.${i}.path`)} />
              </>
            )}
          />
        </>
      );
    case "logo_strip":
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <TextInput label="Heading (optional)" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} hint="For example “Members of” or “As seen in”." />
            <SelectInput label="Columns (grid)" value={section.columns ? String(section.columns) : ""} onChange={(v) => onChange({ ...section, columns: v ? (Number(v) as 2 | 3 | 4) : undefined })} options={columnOptions} />
          </div>
          <ItemList
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            empty="No logos yet. Upload each logo in Media with its alternative text (the organisation's name), then choose it here."
            addLabel="Add logo"
            max={16}
            blank={() => ({ assetId: "", label: "", path: "" })}
            render={(item, update, i) => (
              <div className="grid gap-2 sm:grid-cols-3">
                <MediaPicker label="Logo" value={item.assetId || null} onChange={(v) => update({ ...item, assetId: v ?? "" })} assets={ctx.assets} siteId={ctx.siteId} />
                <TextInput label="Name (optional)" value={item.label} onChange={(v) => update({ ...item, label: v })} hint="Shown under the logo when set." error={err(`items.${i}.assetId`) ?? err(`items.${i}.label`)} />
                <TextInput label="Link (optional)" value={item.path} onChange={(v) => update({ ...item, path: v })} hint="Site path or https:// address" error={err(`items.${i}.path`)} />
              </div>
            )}
          />
        </>
      );
    case "image_text":
      return (
        <>
          <TextInput label="Heading (optional)" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <ItemList
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            empty="No rows yet. Each row is a picture beside a heading and some text; the sides alternate."
            addLabel="Add row"
            max={8}
            blank={() => ({ assetId: "", heading: "", body: [], ctaLabel: "", ctaPath: "" })}
            render={(item, update, i) => (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <MediaPicker label="Picture" value={item.assetId || null} onChange={(v) => update({ ...item, assetId: v ?? "" })} assets={ctx.assets} siteId={ctx.siteId} />
                  <TextInput label="Heading" value={item.heading} onChange={(v) => update({ ...item, heading: v })} required error={err(`items.${i}.assetId`) ?? err(`items.${i}.heading`)} />
                </div>
                <BodyEditor label="Text" blocks={item.body as Block[]} onChange={(b) => update({ ...item, body: b })} rows={4} error={err(`items.${i}.body`)} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <TextInput label="Button label (optional)" value={item.ctaLabel} onChange={(v) => update({ ...item, ctaLabel: v })} error={err(`items.${i}.ctaLabel`)} />
                  <TextInput label="Button link" value={item.ctaPath} onChange={(v) => update({ ...item, ctaPath: v })} hint="Site path or https:// address" error={err(`items.${i}.ctaPath`)} />
                </div>
              </>
            )}
          />
        </>
      );
    case "image_band":
      return (
        <>
          <TextInput label="Heading" value={section.heading} onChange={(v) => onChange({ ...section, heading: v })} error={err("heading")} />
          <TextArea label="Text (optional)" value={section.text} onChange={(v) => onChange({ ...section, text: v })} rows={2} />
          <div className="grid gap-3 sm:grid-cols-3">
            <MediaPicker label="Picture" value={section.imageAssetId} onChange={(v) => onChange({ ...section, imageAssetId: v })} assets={ctx.assets} siteId={ctx.siteId} hint="Spans the full width of the page; the crop keeps the focal point set in Media." />
            <SelectInput label="Colour wash" value={section.tint} onChange={(v) => onChange({ ...section, tint: v as typeof section.tint })} options={bandTints.map((t) => ({ value: t, label: bandTintLabels[t] }))} hint="A brand colour laid over the picture; the text uses that colour's readable pairing." />
            <SelectInput label="Wash strength" value={section.strength} onChange={(v) => onChange({ ...section, strength: v as typeof section.strength })} options={bandStrengths.map((s) => ({ value: s, label: bandStrengthLabels[s] }))} hint="Medium or strong keeps the text readable on any picture." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Button label (optional)" value={section.ctaLabel} onChange={(v) => onChange({ ...section, ctaLabel: v })} error={err("ctaLabel")} />
            <TextInput label="Button link" value={section.ctaPath} onChange={(v) => onChange({ ...section, ctaPath: v })} hint="Site path or https:// address" error={err("ctaPath")} />
            <TextInput label="Second button label (optional)" value={section.secondaryLabel} onChange={(v) => onChange({ ...section, secondaryLabel: v })} error={err("secondaryLabel")} />
            <TextInput label="Second button link" value={section.secondaryPath} onChange={(v) => onChange({ ...section, secondaryPath: v })} error={err("secondaryPath")} />
          </div>
        </>
      );
  }
}

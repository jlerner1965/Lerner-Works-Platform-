"use client";

import type { EditorContext, Issues, Payload } from "@/components/admin/editor/types";
import { TextInput, TextArea, SelectInput, Checkbox, MultiSelect, Fieldset } from "@/components/admin/editor/inputs";
import { BodyEditor } from "@/components/admin/editor/body-editor";
import { MediaPicker, DocumentPicker } from "@/components/admin/editor/media-picker";
import { SectionsEditor, ItemList } from "@/components/admin/editor/sections-editor";
import { AddressFields } from "@/components/admin/editor/address-fields";
import { WeeklyHoursEditor, ExceptionsEditor, emptyWeek } from "@/components/admin/editor/hours-editor";
import type { PageSection } from "@/modules/page";
import type { Address, Attachment, HoursException, WeeklyHours } from "@/modules/common";
import type { Block } from "@/lib/richtext";
import type { ContentKind } from "@/modules/registry";
import { themeCapabilities } from "@/themes/capabilities";
import { toLocalInput, fromLocalInput } from "@/lib/local-time";

interface FieldsProps {
  kind: ContentKind;
  preset: "community_guide" | "location_business";
  payload: Payload;
  set: (patch: Payload) => void;
  ctx: EditorContext;
  issues: Issues;
}

export function KindFields(props: FieldsProps) {
  const { kind, payload, set, ctx, issues } = props;
  const s = (k: string) => String(payload[k] ?? "");
  switch (kind) {
    case "page": {
      const capabilities = themeCapabilities[ctx.themeKey];
      return (
        <Fieldset legend="Page sections" description={`Ordered sections make up the page. Use Move up/Move down to reorder. Each section has a style and an appearance; the ${capabilities.label} theme offers the choices shown.`}>
          <SectionsEditor sections={(payload.sections as PageSection[]) ?? []} onChange={(sections) => set({ sections })} ctx={ctx} issues={issues} capabilities={capabilities} />
        </Fieldset>
      );
    }
    case "place": {
      const hours = payload.hours as WeeklyHours | null;
      return (
        <>
          <Fieldset legend="Place details">
            <TextInput label="Category" value={s("category")} onChange={(v) => set({ category: v })} required error={issues.category} hint="Visitors filter the directory by category; reuse existing names for consistency." suggestions={ctx.categories} />
            <TextInput label="Website" value={s("website")} onChange={(v) => set({ website: v })} error={issues.website} placeholder="https://" />
            <TextInput label="Phone" value={s("phone")} onChange={(v) => set({ phone: v })} error={issues.phone} />
            <TextArea label="Area description (when no exact address should be shown)" value={s("areaDescription")} onChange={(v) => set({ areaDescription: v })} rows={2} />
            <div className="grid gap-x-3 sm:grid-cols-2">
              <TextInput label="Next action label" value={String((payload.nextAction as { label: string })?.label ?? "")} onChange={(v) => set({ nextAction: { ...(payload.nextAction as object), label: v } })} hint="e.g. Plan a visit" />
              <TextInput label="Next action link" value={String((payload.nextAction as { path: string })?.path ?? "")} onChange={(v) => set({ nextAction: { ...(payload.nextAction as object), path: v } })} hint="Site path or https URL" />
            </div>
          </Fieldset>
          <Fieldset legend="Approved address">
            <AddressFields value={payload.address as Address} onChange={(address) => set({ address })} issues={issues} prefix="address" />
          </Fieldset>
          <Fieldset legend="Opening hours" description="Leave unknown unless verified. Unknown is shown as “Hours not published”; nothing is inferred from the category.">
            <Checkbox label="Hours are known" checked={hours !== null} onChange={(v) => set({ hours: v ? emptyWeek() : null })} />
            {hours ? <WeeklyHoursEditor value={hours} onChange={(h) => set({ hours: h })} error={issues.hours} /> : null}
          </Fieldset>
        </>
      );
    }
    case "event": {
      const places = (ctx.related.place ?? []).map((p) => ({ value: p.id, label: p.title }));
      return (
        <Fieldset legend="Event details" description="Times are stored as instants and displayed in the event's time zone.">
          <div className="grid gap-x-3 sm:grid-cols-3">
            <TextInput label="Starts (local date and time)" type="datetime-local" value={toLocalInput(s("startsAt"), s("timeZone"))} onChange={(v) => set({ startsAt: fromLocalInput(v, s("timeZone")) })} required error={issues.startsAt} />
            <TextInput label="Ends (local date and time)" type="datetime-local" value={toLocalInput(s("endsAt"), s("timeZone"))} onChange={(v) => set({ endsAt: fromLocalInput(v, s("timeZone")) })} required error={issues.endsAt} />
            <TextInput label="Time zone (IANA)" value={s("timeZone")} onChange={(v) => set({ timeZone: v })} required error={issues.timeZone} hint="e.g. America/Denver" />
          </div>
          <SelectInput label="Status" value={s("status")} onChange={(v) => set({ status: v })} options={[{ value: "scheduled", label: "Scheduled" }, { value: "cancelled", label: "Cancelled (stays visible)" }, { value: "postponed", label: "Postponed" }]} />
          <SelectInput label="Venue (a listed place)" value={String(payload.venueItemId ?? "")} onChange={(v) => set({ venueItemId: v || null })} options={[{ value: "", label: "Not a listed place" }, ...places]} error={issues.venueItemId} />
          <TextInput label="Venue text (if not a listed place)" value={s("venueText")} onChange={(v) => set({ venueText: v })} />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <TextInput label="Organizer" value={s("organizerName")} onChange={(v) => set({ organizerName: v })} />
            <TextInput label="Organizer URL" value={s("organizerUrl")} onChange={(v) => set({ organizerUrl: v })} error={issues.organizerUrl} placeholder="https://" />
            <TextInput label="Event URL" value={s("eventUrl")} onChange={(v) => set({ eventUrl: v })} error={issues.eventUrl} placeholder="https://" />
            <TextInput label="Admission" value={s("admission")} onChange={(v) => set({ admission: v })} hint="As supplied by the organizer, e.g. Free, or $12 at the door." />
          </div>
        </Fieldset>
      );
    }
    case "article":
      return (
        <Fieldset legend="Article details">
          <TextInput label="Author or organizational attribution" value={s("authorName")} onChange={(v) => set({ authorName: v })} required error={issues.authorName} />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <TextInput label="Original publication date" type="date" value={s("publishedOn")} onChange={(v) => set({ publishedOn: v })} required error={issues.publishedOn} />
            <TextInput label="Updated date" type="date" value={s("updatedOn")} onChange={(v) => set({ updatedOn: v })} error={issues.updatedOn} />
          </div>
        </Fieldset>
      );
    case "store": {
      const hours = payload.weeklyHours as WeeklyHours | null;
      const services = (ctx.related.service ?? []).map((p) => ({ value: p.id, label: p.title }));
      return (
        <>
          <Fieldset legend="Store details">
            <div className="grid gap-x-3 sm:grid-cols-2">
              <TextInput label="Phone" value={s("phone")} onChange={(v) => set({ phone: v })} />
              <TextInput label="Time zone (IANA)" value={s("timeZone")} onChange={(v) => set({ timeZone: v })} required error={issues.timeZone} />
            </div>
            <SelectInput label="Status" value={s("status")} onChange={(v) => set({ status: v })} options={[{ value: "open", label: "Open (normal operation)" }, { value: "temporarily_closed", label: "Temporarily closed" }, { value: "permanently_closed", label: "Permanently closed" }]} />
            <TextInput label="Status note" value={s("statusNote")} onChange={(v) => set({ statusNote: v })} hint="Shown with a closure, e.g. Reopening after renovation in March." />
            <MultiSelect label="Services available at this store" values={(payload.serviceItemIds as string[]) ?? []} onChange={(v) => set({ serviceItemIds: v })} options={services} error={issues.serviceItemIds} />
          </Fieldset>
          <Fieldset legend="Approved address">
            <AddressFields value={payload.address as Address} onChange={(address) => set({ address })} issues={issues} prefix="address" />
          </Fieldset>
          <Fieldset legend="Weekly hours" description="Unknown is different from closed: an empty day means closed; unknown hides the table.">
            <Checkbox label="Weekly hours are known" checked={hours !== null} onChange={(v) => set({ weeklyHours: v ? emptyWeek() : null })} />
            {hours ? <WeeklyHoursEditor value={hours} onChange={(h) => set({ weeklyHours: h })} error={issues.weeklyHours} /> : null}
          </Fieldset>
          <Fieldset legend="Date exceptions" description="Holidays and temporary changes override the weekly pattern for that local date.">
            <ExceptionsEditor value={(payload.exceptions as HoursException[]) ?? []} onChange={(exceptions) => set({ exceptions })} />
            {issues.exceptions ? <p className="mt-1 text-sm text-danger">{issues.exceptions}</p> : null}
          </Fieldset>
        </>
      );
    }
    case "service":
      return (
        <Fieldset legend="Service details">
          <TextArea label="Inquiry prompt" value={s("inquiryPrompt")} onChange={(v) => set({ inquiryPrompt: v })} rows={2} hint="Optional sentence inviting an inquiry, shown on the service page." />
        </Fieldset>
      );
    case "link":
      return (
        <Fieldset legend="Link details" description="A link to another website: the card and the button open it directly, without passing on where the visitor came from. The title, summary and picture above are this site's own words about it.">
          <TextInput label="Web address" value={s("url")} onChange={(v) => set({ url: v })} required error={issues.url} placeholder="https://" hint="The full https:// address of the other website." />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <TextInput label="Category" value={s("category")} onChange={(v) => set({ category: v })} error={issues.category} hint="Groups the links page; reuse existing names for consistency." suggestions={ctx.linkCategories} />
            <TextInput label="Button label" value={s("ctaLabel")} onChange={(v) => set({ ctaLabel: v })} error={issues.ctaLabel} hint="On the link's own page; empty reads “Visit <the other site>”." />
          </div>
        </Fieldset>
      );
  }
}

export function CommonFields({ payload, set, ctx, issues, kind }: { payload: Payload; set: (patch: Payload) => void; ctx: EditorContext; issues: Issues; kind: ContentKind }) {
  const s = (k: string) => String(payload[k] ?? "");
  const showBody = kind !== "page";
  return (
    <>
      <Fieldset legend="Identity">
        <TextInput label={kind === "article" ? "Headline" : "Title"} value={s("title")} onChange={(v) => set({ title: v })} required error={issues.title} />
        <TextInput label="Slug" value={s("slug")} onChange={(v) => set({ slug: v })} required error={issues.slug} hint="Changing a published slug creates a redirect from the old address in the next release." />
        <TextArea label="Summary" value={s("summary")} onChange={(v) => set({ summary: v })} rows={2} error={issues.summary} hint="Shown in listings and used as the default description." />
        <MediaPicker
          label="Featured image"
          value={(payload.featuredImageAssetId as string | null) ?? null}
          onChange={(v) => set({ featuredImageAssetId: v })}
          assets={ctx.assets}
          siteId={ctx.siteId}
          hint={kind === "page" ? "Shown as the page's header image (unless the page opens with an image hero) and as its share image for links." : "Shown in listings, on the detail page and as the share image for links."}
        />
      </Fieldset>
      {showBody ? (
        <Fieldset legend="Body">
          <BodyEditor blocks={(payload.body as Block[]) ?? []} onChange={(body) => set({ body })} error={issues.body} />
        </Fieldset>
      ) : null}
      {showBody ? (
        <Fieldset legend="Downloads" description="Documents (PDF) from Media listed under the text with their type and size, served from the published site like pictures. Pages list documents with a Downloads section instead.">
          <ItemList
            items={((payload.attachments as Attachment[] | undefined) ?? [])}
            onChange={(attachments) => set({ attachments })}
            empty="No documents attached."
            addLabel="Attach a document"
            max={20}
            blank={() => ({ assetId: "", label: "" })}
            render={(item, update, i) => (
              <div className="grid gap-2 sm:grid-cols-2">
                <DocumentPicker label="Document" value={item.assetId || null} onChange={(v) => update({ ...item, assetId: v ?? "" })} assets={ctx.assets} siteId={ctx.siteId} error={issues[`attachments.${i}.assetId`]} />
                <TextInput label="Link text (optional)" value={item.label} onChange={(v) => update({ ...item, label: v })} hint="The document's title when empty." error={issues[`attachments.${i}.label`]} />
              </div>
            )}
          />
        </Fieldset>
      ) : null}
      <Fieldset legend="Metadata and provenance">
        <div className="grid gap-x-3 sm:grid-cols-2">
          <TextInput label="Meta title" value={s("metaTitle")} onChange={(v) => set({ metaTitle: v })} maxLength={70} error={issues.metaTitle} />
          <TextInput label="Meta description" value={s("metaDescription")} onChange={(v) => set({ metaDescription: v })} maxLength={200} error={issues.metaDescription} />
          <TextInput label="Source URL" value={s("sourceUrl")} onChange={(v) => set({ sourceUrl: v })} error={issues.sourceUrl} placeholder="https://" />
          <TextInput label="Last verified date" type="date" value={s("lastVerifiedOn")} onChange={(v) => set({ lastVerifiedOn: v })} error={issues.lastVerifiedOn} />
          <TextInput label="Attribution" value={s("attribution")} onChange={(v) => set({ attribution: v })} error={issues.attribution} />
        </div>
        <Checkbox label="Allow search engines to index this page" checked={payload.indexable !== false} onChange={(v) => set({ indexable: v })} />
      </Fieldset>
    </>
  );
}

// Wall-clock conversions live in src/lib/local-time.ts, shared with the server-side imports.

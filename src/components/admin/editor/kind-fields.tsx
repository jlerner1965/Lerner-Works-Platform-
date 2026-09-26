"use client";

import type { EditorContext, Issues, Payload } from "@/components/admin/editor/types";
import { TextInput, TextArea, SelectInput, Checkbox, MultiSelect, Fieldset } from "@/components/admin/editor/inputs";
import { BodyEditor } from "@/components/admin/editor/body-editor";
import { MediaPicker } from "@/components/admin/editor/media-picker";
import { SectionsEditor } from "@/components/admin/editor/sections-editor";
import { WeeklyHoursEditor, ExceptionsEditor, emptyWeek } from "@/components/admin/editor/hours-editor";
import type { PageSection, SectionType } from "@/modules/page";
import type { Address, HoursException, WeeklyHours } from "@/modules/common";
import type { Block } from "@/lib/richtext";
import type { ContentKind } from "@/modules/registry";

interface FieldsProps {
  kind: ContentKind;
  preset: "community_guide" | "location_business";
  payload: Payload;
  set: (patch: Payload) => void;
  ctx: EditorContext;
  issues: Issues;
}

function AddressFields({ value, onChange, issues, prefix }: { value: Address; onChange: (a: Address) => void; issues: Issues; prefix: string }) {
  return (
    <div className="grid gap-x-3 sm:grid-cols-2">
      <TextInput label="Address line 1" value={value.line1} onChange={(v) => onChange({ ...value, line1: v })} error={issues[`${prefix}.line1`]} />
      <TextInput label="Address line 2" value={value.line2} onChange={(v) => onChange({ ...value, line2: v })} />
      <TextInput label="City / locality" value={value.locality} onChange={(v) => onChange({ ...value, locality: v })} />
      <TextInput label="State / region" value={value.region} onChange={(v) => onChange({ ...value, region: v })} />
      <TextInput label="Postal code" value={value.postalCode} onChange={(v) => onChange({ ...value, postalCode: v })} />
      <div className="sm:col-span-2">
        <Checkbox label="Address approved by the owner for public direction links" checked={value.approved} onChange={(v) => onChange({ ...value, approved: v })} hint="Direction links are generated only from approved addresses on live sites." />
      </div>
    </div>
  );
}

export function KindFields(props: FieldsProps) {
  const { kind, payload, set, ctx, issues } = props;
  const s = (k: string) => String(payload[k] ?? "");
  switch (kind) {
    case "page": {
      const allowed: SectionType[] = props.preset === "community_guide"
        ? ["image_hero", "text_hero", "rich_text", "feature_list", "content_collection", "contact_callout", "inquiry_form"]
        : ["text_hero", "image_hero", "rich_text", "feature_list", "location_collection", "content_collection", "contact_callout", "inquiry_form"];
      return (
        <Fieldset legend="Page sections" description="Ordered sections make up the page. Use Move up/Move down to reorder.">
          <SectionsEditor sections={(payload.sections as PageSection[]) ?? []} onChange={(sections) => set({ sections })} ctx={ctx} issues={issues} allowedTypes={allowed} />
        </Fieldset>
      );
    }
    case "place": {
      const hours = payload.hours as WeeklyHours | null;
      return (
        <>
          <Fieldset legend="Place details">
            <TextInput label="Category" value={s("category")} onChange={(v) => set({ category: v })} required error={issues.category} hint="Visitors filter the directory by category; reuse existing names for consistency." />
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
        <MediaPicker label="Featured image" value={(payload.featuredImageAssetId as string | null) ?? null} onChange={(v) => set({ featuredImageAssetId: v })} assets={ctx.assets} siteId={ctx.siteId} />
      </Fieldset>
      {showBody ? (
        <Fieldset legend="Body">
          <BodyEditor blocks={(payload.body as Block[]) ?? []} onChange={(body) => set({ body })} error={issues.body} />
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

/** datetime-local value for an instant in a zone (YYYY-MM-DDTHH:MM). */
export function toLocalInput(iso: string, timeZone: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
  } catch {
    return "";
  }
}

/** Instant for a wall-clock time in a zone, found by iterating the zone offset. */
export function fromLocalInput(local: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return "";
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const back = toLocalInput(new Date(guess).toISOString(), timeZone);
    if (back === local.slice(0, 16)) break;
    const bm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(back);
    if (!bm) break;
    const [by, bmo, bd, bh, bmi] = bm.slice(1).map(Number) as [number, number, number, number, number];
    guess += Date.UTC(y, mo - 1, d, h, mi) - Date.UTC(by, bmo - 1, bd, bh, bmi);
  }
  return new Date(guess).toISOString();
}

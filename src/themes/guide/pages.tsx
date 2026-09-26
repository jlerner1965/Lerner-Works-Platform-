import type { RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { SnapshotItem } from "@/server/publishing/snapshot";
import type { ContentKind } from "@/modules/registry";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { featuredImage, itemPath } from "@/themes/shared/collections";
import { indexCopy } from "@/themes/shared/site-root";
import { GuideCollection } from "@/themes/guide/index";
import { formatEventDate, formatEventTimeRange, formatDateOnly, classifyEvent } from "@/lib/events";
import { formatWeeklyHours } from "@/lib/hours";
import type { WeeklyHours } from "@/modules/common";
import { searchSnapshot } from "@/server/publishing/search";
import type { Block } from "@/lib/richtext";

function Facts({ items }: { items: Array<{ term: string; value: React.ReactNode }> }) {
  const shown = items.filter((i) => i.value);
  if (!shown.length) return null;
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 border-y border-(--brand-border) py-4 text-sm">
      {shown.map((i) => (
        <div key={i.term} className="contents">
          <dt className="pt-0.5 text-xs font-semibold uppercase tracking-wider text-(--brand-muted)">{i.term}</dt>
          <dd>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function GuidePlaceDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const img = featuredImage(ctx, item);
  const address = p.address as { line1: string; line2: string; locality: string; region: string; postalCode: string } | undefined;
  const addressText = address && (address.line1 || address.locality) ? [address.line1, address.line2, [address.locality, address.region, address.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ") : String(p.areaDescription ?? "");
  const hours = p.hours as WeeklyHours | null;
  const next = p.nextAction as { label: string; path: string } | undefined;
  return (
    <article className="grid gap-8 md:grid-cols-[3fr_2fr]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-(--brand-accent)">{String(p.category)}</p>
        <h1 className="mt-1 font-(family-name:--font-heading) text-4xl font-bold text-(--brand-primary)">{item.title}</h1>
        {p.summary ? <p className="mt-3 text-lg">{String(p.summary)}</p> : null}
        {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 60vw, 100vw" className="mt-6 aspect-[3/2] w-full object-cover" loading="eager" fetchPriority="high" /> : null}
        <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="guide-prose mt-6" />
        {next?.label && next.path ? (
          <p className="mt-6">
            <a href={next.path.startsWith("/") ? href(ctx, next.path) : next.path} className="inline-block bg-(--brand-primary) px-5 py-2.5 font-semibold text-(--brand-on-primary) hover:opacity-90" {...(next.path.startsWith("http") ? { rel: "noreferrer" } : {})}>
              {next.label}
            </a>
          </p>
        ) : null}
      </div>
      <aside className="md:border-l md:border-(--brand-border) md:pl-8">
        <h2 className="mb-3 font-(family-name:--font-heading) text-xl font-bold">Useful information</h2>
        <Facts
          items={[
            { term: "Where", value: addressText || "Location not published" },
            { term: "Website", value: p.website ? <a href={String(p.website)} rel="noreferrer" className="text-(--brand-accent) underline">{String(p.website).replace(/^https?:\/\//, "")}</a> : null },
            { term: "Phone", value: String(p.phone ?? "") },
            { term: "Hours", value: hours ? <HoursList hours={hours} /> : <span>Hours not published — check before visiting.</span> },
            { term: "Verified", value: p.lastVerifiedOn ? formatDateOnly(String(p.lastVerifiedOn)) : "Not yet verified" },
            { term: "Source", value: p.sourceUrl ? <a href={String(p.sourceUrl)} rel="noreferrer" className="underline">{String(p.sourceUrl).replace(/^https?:\/\//, "").slice(0, 40)}</a> : String(p.attribution ?? "") },
          ]}
        />
        <p className="mt-4 text-sm"><a href={href(ctx, "/places")} className="text-(--brand-accent) underline">← All places</a></p>
      </aside>
    </article>
  );
}

function HoursList({ hours }: { hours: WeeklyHours }) {
  return (
    <ul className="space-y-0.5">
      {formatWeeklyHours(hours).map((row) => (
        <li key={row.day} className="flex justify-between gap-3"><span>{row.day}</span><span>{row.text}</span></li>
      ))}
    </ul>
  );
}

export function GuideEventDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const tz = String(p.timeZone);
  const startsAt = String(p.startsAt);
  const endsAt = String(p.endsAt);
  const phase = classifyEvent(startsAt, endsAt, ctx.now);
  const venue = p.venueItemId ? ctx.snapshot.items[String(p.venueItemId)] : null;
  const venuePath = venue ? itemPath(ctx, venue) : null;
  const img = featuredImage(ctx, item);
  return (
    <article className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-(--brand-accent)">
        Event · {phase === "past" ? "Past event" : phase === "in_progress" ? "Happening now" : "Upcoming"}
      </p>
      <h1 className="mt-1 font-(family-name:--font-heading) text-4xl font-bold text-(--brand-primary)">{item.title}</h1>
      {p.status === "cancelled" ? (
        <p role="status" className="mt-4 border-l-4 border-(--brand-danger) bg-(--brand-danger-soft) px-4 py-2 font-semibold text-(--brand-danger)">This event has been cancelled.</p>
      ) : p.status === "postponed" ? (
        <p role="status" className="mt-4 border-l-4 border-(--brand-accent) bg-(--brand-surface) px-4 py-2 font-semibold">This event has been postponed. Check back for a new date.</p>
      ) : null}
      <Facts
        items={[
          { term: "When", value: `${formatEventDate(startsAt, tz)}, ${formatEventTimeRange(startsAt, endsAt, tz)}` },
          { term: "Where", value: venue ? (venuePath ? <a href={href(ctx, venuePath)} className="text-(--brand-accent) underline">{venue.title}</a> : venue.title) : String(p.venueText ?? "") },
          { term: "Organizer", value: p.organizerUrl ? <a href={String(p.organizerUrl)} rel="noreferrer" className="underline">{String(p.organizerName)}</a> : String(p.organizerName ?? "") },
          { term: "Admission", value: String(p.admission ?? "") },
          { term: "Details", value: p.eventUrl ? <a href={String(p.eventUrl)} rel="noreferrer" className="underline">Event website</a> : null },
        ]}
      />
      {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 720px, 100vw" className="mt-6 aspect-[16/9] w-full object-cover" /> : null}
      {p.summary ? <p className="mt-6 text-lg">{String(p.summary)}</p> : null}
      <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="guide-prose mt-4" />
      <p className="mt-8 text-sm"><a href={href(ctx, "/events")} className="text-(--brand-accent) underline">← All events</a></p>
    </article>
  );
}

export function GuideArticleDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const img = featuredImage(ctx, item);
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="font-(family-name:--font-heading) text-4xl font-bold leading-tight text-(--brand-primary)">{item.title}</h1>
      {p.summary ? <p className="mt-3 text-xl text-(--brand-muted)">{String(p.summary)}</p> : null}
      <p className="mt-3 text-sm text-(--brand-muted)">
        By {String(p.authorName)} · Published {formatDateOnly(String(p.publishedOn))}
        {p.updatedOn ? ` · Updated ${formatDateOnly(String(p.updatedOn))}` : ""}
      </p>
      {img ? (
        <figure className="mt-6">
          <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 720px, 100vw" className="aspect-[16/9] w-full object-cover" loading="eager" fetchPriority="high" />
          {img.attribution ? <figcaption className="mt-1 text-xs text-(--brand-muted)">{img.attribution}</figcaption> : null}
        </figure>
      ) : null}
      <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="guide-prose mt-6" />
      <p className="mt-8 text-sm"><a href={href(ctx, "/articles")} className="text-(--brand-accent) underline">← All articles</a></p>
    </article>
  );
}

/** Theme defaults for listing pages; owners override them in Settings → Listing pages. */
const indexDefaults: Partial<Record<ContentKind, { title: string; intro: string }>> = {
  place: { title: "Directory", intro: "Places listed in the guide, with verification dates so you know how current the details are." },
  event: { title: "Events", intro: "Upcoming community events. Cancelled events stay listed so nobody shows up to an empty room." },
  article: { title: "Articles", intro: "Short pieces from the guide." },
};

const filterChip = "border px-3 py-1";
const filterChipActive = "border-(--brand-primary) bg-(--brand-primary) text-(--brand-on-primary)";
const filterChipIdle = "border-(--brand-border-strong) hover:border-(--brand-primary)";

export function GuideIndex({ ctx, kind }: { ctx: RenderContext; kind: ContentKind }) {
  const meta = indexCopy(ctx, kind, indexDefaults[kind] ?? { title: kind, intro: "" });
  const routed = new Set(ctx.snapshot.routes.filter((r) => r.itemId).map((r) => r.itemId));
  let items = Object.values(ctx.snapshot.items).filter((i) => i.kind === kind && routed.has(i.id));
  const q = ctx.query;
  const categories = kind === "place" ? [...new Set(items.map((i) => String(i.payload.category)))].sort() : [];
  const filtersActive = Boolean(q.category || q.from || q.to || q.show);
  if (kind === "place") {
    if (q.category) items = items.filter((i) => String(i.payload.category) === q.category);
    items.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (kind === "event") {
    items.sort((a, b) => Date.parse(String(a.payload.startsAt)) - Date.parse(String(b.payload.startsAt)));
    const show = q.show === "past" ? "past" : "upcoming";
    items = items.filter((i) => (classifyEvent(String(i.payload.startsAt), String(i.payload.endsAt), ctx.now) === "past") === (show === "past"));
    if (q.from) items = items.filter((i) => String(i.payload.startsAt).slice(0, 10) >= q.from!);
    if (q.to) items = items.filter((i) => String(i.payload.startsAt).slice(0, 10) <= q.to!);
    if (show === "past") items.reverse();
  }
  if (kind === "article") items.sort((a, b) => String(b.payload.publishedOn).localeCompare(String(a.payload.publishedOn)));
  const total = Object.values(ctx.snapshot.items).filter((i) => i.kind === kind && routed.has(i.id)).length;
  return (
    <div>
      <h1 className="font-(family-name:--font-heading) text-4xl font-bold text-(--brand-primary)">{meta.title}</h1>
      {meta.intro ? <p className="mt-2 max-w-2xl text-lg">{meta.intro}</p> : null}
      {kind === "place" && categories.length ? (
        <nav aria-label="Filter by category" className="mt-6 flex flex-wrap gap-2 text-sm">
          <a href={href(ctx, "/places")} className={`${filterChip} ${!q.category ? filterChipActive : filterChipIdle}`} aria-current={!q.category ? "page" : undefined}>All ({total})</a>
          {categories.map((c) => (
            <a key={c} href={`${href(ctx, "/places")}?category=${encodeURIComponent(c)}`} className={`${filterChip} ${q.category === c ? filterChipActive : filterChipIdle}`} aria-current={q.category === c ? "page" : undefined}>{c}</a>
          ))}
        </nav>
      ) : null}
      {kind === "event" ? (
        <form method="get" action={href(ctx, "/events")} className="mt-6 flex flex-wrap items-end gap-3 border-y border-(--brand-border) py-3 text-sm">
          <fieldset className="flex gap-2">
            <legend className="sr-only">Show</legend>
            <a href={href(ctx, "/events")} className={`${filterChip} ${q.show !== "past" ? filterChipActive : "border-(--brand-border-strong)"}`} aria-current={q.show !== "past" ? "page" : undefined}>Upcoming</a>
            <a href={`${href(ctx, "/events")}?show=past`} className={`${filterChip} ${q.show === "past" ? filterChipActive : "border-(--brand-border-strong)"}`} aria-current={q.show === "past" ? "page" : undefined}>Past</a>
          </fieldset>
          {q.show === "past" ? <input type="hidden" name="show" value="past" /> : null}
          <label className="flex flex-col">From<input type="date" name="from" defaultValue={q.from ?? ""} className="border border-(--brand-border-strong) bg-(--brand-bg) px-2 py-1 text-(--brand-text)" /></label>
          <label className="flex flex-col">To<input type="date" name="to" defaultValue={q.to ?? ""} className="border border-(--brand-border-strong) bg-(--brand-bg) px-2 py-1 text-(--brand-text)" /></label>
          <button type="submit" className="bg-(--brand-primary) px-3 py-1.5 font-semibold text-(--brand-on-primary)">Apply dates</button>
          {filtersActive ? <a href={href(ctx, "/events")} className="underline">Reset filters</a> : null}
        </form>
      ) : null}
      <div className="mt-8">
        {items.length === 0 ? (
          <div className="border border-dashed border-(--brand-border-strong) p-6">
            <p className="font-semibold">{filtersActive ? "Nothing matches these filters." : `Nothing has been published in ${meta.title.toLowerCase()} yet.`}</p>
            {filtersActive ? <p className="mt-1 text-sm"><a href={href(ctx, kind === "place" ? "/places" : "/events")} className="text-(--brand-accent) underline">Clear filters</a> to see everything.</p> : null}
          </div>
        ) : (
          <GuideCollection ctx={ctx} kind={kind} items={items} mode="latest" />
        )}
      </div>
    </div>
  );
}

export function GuideSearch({ ctx }: { ctx: RenderContext }) {
  const q = (ctx.query.q ?? "").trim();
  const kind = ctx.query.kind ?? "";
  const results = q ? searchSnapshot(ctx.snapshot, { query: q, kind: kind || undefined, now: ctx.now }) : [];
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-(family-name:--font-heading) text-4xl font-bold text-(--brand-primary)">Search</h1>
      <form method="get" action={href(ctx, "/search")} role="search" className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">Search the guide</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Places, events, articles" className="min-w-0 flex-1 border border-(--brand-border-strong) bg-(--brand-bg) px-3 py-2 text-(--brand-text)" />
        <label htmlFor="kind" className="sr-only">Type</label>
        <select id="kind" name="kind" defaultValue={kind} className="border border-(--brand-border-strong) bg-(--brand-bg) px-2 py-2 text-(--brand-text)">
          <option value="">Everything</option>
          <option value="place">Places</option>
          <option value="event">Events</option>
          <option value="article">Articles</option>
          <option value="page">Pages</option>
        </select>
        <button type="submit" className="bg-(--brand-primary) px-4 py-2 font-semibold text-(--brand-on-primary)">Search</button>
        {q ? <a href={href(ctx, "/search")} className="self-center text-sm underline">Clear</a> : null}
      </form>
      <div className="mt-6" aria-live="polite">
        {q && results.length === 0 ? (
          <p className="border border-dashed border-(--brand-border-strong) p-6">No results for “{q}”. Try a shorter word, a category name, or browse the <a href={href(ctx, "/places")} className="text-(--brand-accent) underline">directory</a>.</p>
        ) : null}
        {results.length ? (
          <ol className="divide-y divide-(--brand-border)">
            {results.map((r) => (
              <li key={r.path} className="py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-(--brand-accent)">{r.kindLabel}{r.meta ? ` · ${r.meta}` : ""}</p>
                <a href={href(ctx, r.path)} className="font-(family-name:--font-heading) text-xl font-semibold hover:underline">{r.title}</a>
                {r.snippet ? <p className="text-sm text-(--brand-muted)">{r.snippet}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}
        {q ? <p className="mt-3 text-xs text-(--brand-muted)">{results.length} result{results.length === 1 ? "" : "s"}</p> : null}
      </div>
    </div>
  );
}

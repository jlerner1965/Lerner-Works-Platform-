import type { ReactNode } from "react";
import type { RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { SnapshotItem } from "@/server/publishing/snapshot";
import type { ContentKind } from "@/modules/registry";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { featuredImage, itemPath } from "@/themes/shared/collections";
import { indexCopy } from "@/themes/shared/site-root";
import { AlmanacCollection, almEyebrow, almH1, almanacStyle } from "@/themes/almanac/index";
import { formatEventDate, formatEventTimeRange, formatDateOnly, classifyEvent } from "@/lib/events";
import { formatWeeklyHours } from "@/lib/hours";
import type { WeeklyHours } from "@/modules/common";
import { searchSnapshot } from "@/server/publishing/search";
import type { Block } from "@/lib/richtext";

const input = "rounded-(--radius) border border-(--brand-border-strong) bg-(--brand-bg) text-(--brand-text)";
const emptyBox = "border border-dashed border-(--brand-border-strong) p-6";

/** Fact sheet: a two-column table of terms and values with hairline rows and small-caps terms. */
function FactSheet({ items, caption }: { items: Array<{ term: string; value: ReactNode }>; caption: string }) {
  const shown = items.filter((i) => i.value);
  if (!shown.length) return null;
  return (
    <table className="w-full border-t border-(--section-border) text-sm">
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {shown.map((i) => (
          <tr key={i.term} className="border-b border-(--section-border) align-top">
            <th scope="row" className={`w-28 py-2.5 pr-4 text-left ${almEyebrow}`}>{i.term}</th>
            <td className="py-2.5">{i.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HoursList({ hours }: { hours: WeeklyHours }) {
  return (
    <ul className="space-y-0.5 tabular-nums">
      {formatWeeklyHours(hours).map((row) => (
        <li key={row.day} className="flex justify-between gap-3"><span>{row.day}</span><span>{row.text}</span></li>
      ))}
    </ul>
  );
}

const backLink = "text-sm font-semibold uppercase tracking-[0.12em] text-(--section-accent) underline decoration-2 underline-offset-4";

export function AlmanacPlaceDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const img = featuredImage(ctx, item);
  const address = p.address as { line1: string; line2: string; locality: string; region: string; postalCode: string } | undefined;
  const addressText = address && (address.line1 || address.locality) ? [address.line1, address.line2, [address.locality, address.region, address.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ") : String(p.areaDescription ?? "");
  const hours = p.hours as WeeklyHours | null;
  const next = p.nextAction as { label: string; path: string } | undefined;
  return (
    <article>
      <header className="border-b border-(--section-border) pb-6">
        <p className={almEyebrow}>{String(p.category)}{p.lastVerifiedOn ? ` · Verified ${formatDateOnly(String(p.lastVerifiedOn))}` : ""}</p>
        <h1 className={`mt-1 ${almH1}`}>{item.title}</h1>
        {p.summary ? <p className="mt-3 max-w-prose text-lg">{String(p.summary)}</p> : null}
      </header>
      <div className="mt-8 grid gap-10 md:grid-cols-[3fr_2fr]">
        <div>
          {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 60vw, 100vw" className="aspect-[3/2] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
          <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className={`alm-prose ${img ? "mt-6" : ""}`} />
          {next?.label && next.path ? (
            <p className="mt-6">
              <a href={next.path.startsWith("/") ? href(ctx, next.path) : next.path} className={almanacStyle.buttonPrimary} {...(next.path.startsWith("http") ? { rel: "noreferrer" } : {})}>
                {next.label}
              </a>
            </p>
          ) : null}
        </div>
        <aside>
          <h2 className={`mb-3 ${almEyebrow}`}>At a glance</h2>
          <FactSheet
            caption={`Details of ${item.title}`}
            items={[
              { term: "Where", value: addressText || "Location not published" },
              { term: "Hours", value: hours ? <HoursList hours={hours} /> : <span>Hours not published — check before visiting.</span> },
              { term: "Phone", value: String(p.phone ?? "") },
              { term: "Website", value: p.website ? <a href={String(p.website)} rel="noreferrer" className="text-(--section-accent) underline">{String(p.website).replace(/^https?:\/\//, "")}</a> : null },
              { term: "Verified", value: p.lastVerifiedOn ? formatDateOnly(String(p.lastVerifiedOn)) : "Not yet verified" },
              { term: "Source", value: p.sourceUrl ? <a href={String(p.sourceUrl)} rel="noreferrer" className="underline">{String(p.sourceUrl).replace(/^https?:\/\//, "").slice(0, 40)}</a> : String(p.attribution ?? "") },
            ]}
          />
          <p className="mt-5"><a href={href(ctx, "/places")} className={backLink}>All places</a></p>
        </aside>
      </div>
    </article>
  );
}

export function AlmanacEventDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const tz = String(p.timeZone);
  const startsAt = String(p.startsAt);
  const endsAt = String(p.endsAt);
  const phase = classifyEvent(startsAt, endsAt, ctx.now);
  const venue = p.venueItemId ? ctx.snapshot.items[String(p.venueItemId)] : null;
  const venuePath = venue ? itemPath(ctx, venue) : null;
  const img = featuredImage(ctx, item);
  const start = new Date(startsAt);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: tz }).format(start);
  const mon = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: tz }).format(start);
  return (
    <article className="grid gap-8 md:grid-cols-[6rem_1fr]">
      <div className="border-l-2 border-(--section-accent) pl-4 md:pl-5">
        <p className={almEyebrow}>{mon}</p>
        <p className="font-(family-name:--font-heading) text-5xl font-bold leading-none tabular-nums text-(--section-heading)">{day}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.12em] text-(--section-muted)">{phase === "past" ? "Past" : phase === "in_progress" ? "Now" : "Upcoming"}</p>
      </div>
      <div className="max-w-3xl">
        <p className={almEyebrow}>Event</p>
        <h1 className={`mt-1 ${almH1}`}>{item.title}</h1>
        {p.status === "cancelled" ? (
          <p role="status" className="mt-4 rounded-(--radius) border-l-4 border-(--brand-danger) bg-(--brand-danger-soft) px-4 py-2 font-semibold text-(--brand-danger)">This event has been cancelled.</p>
        ) : p.status === "postponed" ? (
          <p role="status" className="mt-4 rounded-(--radius) border-l-4 border-(--section-accent) bg-(--section-panel) px-4 py-2 font-semibold text-(--section-panel-fg)">This event has been postponed. Check back for a new date.</p>
        ) : null}
        <div className="mt-5">
          <FactSheet
            caption={`Details of ${item.title}`}
            items={[
              { term: "When", value: `${formatEventDate(startsAt, tz)}, ${formatEventTimeRange(startsAt, endsAt, tz)}` },
              { term: "Where", value: venue ? (venuePath ? <a href={href(ctx, venuePath)} className="text-(--section-accent) underline">{venue.title}</a> : venue.title) : String(p.venueText ?? "") },
              { term: "Organizer", value: p.organizerUrl ? <a href={String(p.organizerUrl)} rel="noreferrer" className="underline">{String(p.organizerName)}</a> : String(p.organizerName ?? "") },
              { term: "Admission", value: String(p.admission ?? "") },
              { term: "Details", value: p.eventUrl ? <a href={String(p.eventUrl)} rel="noreferrer" className="underline">Event website</a> : null },
            ]}
          />
        </div>
        {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 720px, 100vw" className="mt-6 aspect-[16/9] w-full rounded-(--radius) object-cover" /> : null}
        {p.summary ? <p className="mt-6 text-lg">{String(p.summary)}</p> : null}
        <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="alm-prose mt-4" />
        <p className="mt-8"><a href={href(ctx, "/events")} className={backLink}>All events</a></p>
      </div>
    </article>
  );
}

export function AlmanacArticleDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const img = featuredImage(ctx, item);
  return (
    <article className="max-w-3xl">
      <p className={almEyebrow}>
        {formatDateOnly(String(p.publishedOn))} · {String(p.authorName)}
        {p.updatedOn ? ` · Updated ${formatDateOnly(String(p.updatedOn))}` : ""}
      </p>
      <h1 className={`mt-2 ${almH1} sm:text-5xl`}>{item.title}</h1>
      {p.summary ? <p className="mt-4 border-b border-(--section-border) pb-6 text-xl leading-relaxed text-(--section-muted)">{String(p.summary)}</p> : null}
      {img ? (
        <figure className="mt-6">
          <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 720px, 100vw" className="aspect-[16/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" />
          {img.attribution ? <figcaption className="mt-1 text-xs text-(--section-muted)">{img.attribution}</figcaption> : null}
        </figure>
      ) : null}
      <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="alm-prose mt-6" />
      <p className="mt-8"><a href={href(ctx, "/articles")} className={backLink}>All articles</a></p>
    </article>
  );
}

/** Theme defaults for listing pages; owners override them in Settings → Listing pages. */
const indexDefaults: Partial<Record<ContentKind, { title: string; intro: string }>> = {
  place: { title: "Directory", intro: "Every place in the guide, with the date its details were last verified." },
  event: { title: "Events", intro: "Upcoming community events. Cancelled events stay listed so nobody shows up to an empty room." },
  article: { title: "Articles", intro: "Short pieces from the guide, newest first." },
};

const filterLink = "inline-block border-b-2 pb-0.5 text-sm font-semibold uppercase tracking-[0.12em]";
const filterActive = "border-(--brand-accent) text-(--brand-accent)";
const filterIdle = "border-transparent hover:border-(--brand-border-strong)";

export function AlmanacIndex({ ctx, kind }: { ctx: RenderContext; kind: ContentKind }) {
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
      <header className="border-b border-(--section-border) pb-6 md:grid md:grid-cols-[2fr_3fr] md:gap-10">
        <h1 className={almH1}>{meta.title}</h1>
        <div>
          {meta.intro ? <p className="mt-2 max-w-2xl text-lg md:mt-1">{meta.intro}</p> : null}
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-(--section-muted)">{items.length === total ? `${total} entr${total === 1 ? "y" : "ies"}` : `${items.length} of ${total} entries`}</p>
        </div>
      </header>
      {kind === "place" && categories.length ? (
        <nav aria-label="Filter by category" className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          <a href={href(ctx, "/places")} className={`${filterLink} ${!q.category ? filterActive : filterIdle}`} aria-current={!q.category ? "page" : undefined}>All <span className="tabular-nums">{total}</span></a>
          {categories.map((c) => (
            <a key={c} href={`${href(ctx, "/places")}?category=${encodeURIComponent(c)}`} className={`${filterLink} ${q.category === c ? filterActive : filterIdle}`} aria-current={q.category === c ? "page" : undefined}>{c}</a>
          ))}
        </nav>
      ) : null}
      {kind === "event" ? (
        <form method="get" action={href(ctx, "/events")} className="mt-5 flex flex-wrap items-end gap-4 border-b border-(--section-border) pb-4 text-sm">
          <fieldset className="flex gap-4">
            <legend className="sr-only">Show</legend>
            <a href={href(ctx, "/events")} className={`${filterLink} ${q.show !== "past" ? filterActive : filterIdle}`} aria-current={q.show !== "past" ? "page" : undefined}>Upcoming</a>
            <a href={`${href(ctx, "/events")}?show=past`} className={`${filterLink} ${q.show === "past" ? filterActive : filterIdle}`} aria-current={q.show === "past" ? "page" : undefined}>Past</a>
          </fieldset>
          {q.show === "past" ? <input type="hidden" name="show" value="past" /> : null}
          <label className={`flex flex-col ${almEyebrow}`}>From<input type="date" name="from" defaultValue={q.from ?? ""} className={`${input} mt-1 px-2 py-1 font-normal normal-case tracking-normal`} /></label>
          <label className={`flex flex-col ${almEyebrow}`}>To<input type="date" name="to" defaultValue={q.to ?? ""} className={`${input} mt-1 px-2 py-1 font-normal normal-case tracking-normal`} /></label>
          <button type="submit" className={almanacStyle.buttonPrimary}>Apply dates</button>
          {filtersActive ? <a href={href(ctx, "/events")} className="underline">Reset filters</a> : null}
        </form>
      ) : null}
      <div className="mt-6">
        {items.length === 0 ? (
          <div className={emptyBox}>
            <p className="font-semibold">{filtersActive ? "Nothing matches these filters." : `Nothing has been published in ${meta.title.toLowerCase()} yet.`}</p>
            {filtersActive ? <p className="mt-1 text-sm"><a href={href(ctx, kind === "place" ? "/places" : "/events")} className="text-(--section-accent) underline">Clear filters</a> to see everything.</p> : null}
          </div>
        ) : (
          <AlmanacCollection ctx={ctx} kind={kind} items={items} variant={kind === "article" ? "list" : "default"} />
        )}
      </div>
    </div>
  );
}

export function AlmanacSearch({ ctx }: { ctx: RenderContext }) {
  const q = (ctx.query.q ?? "").trim();
  const kind = ctx.query.kind ?? "";
  const results = q ? searchSnapshot(ctx.snapshot, { query: q, kind: kind || undefined, now: ctx.now }) : [];
  return (
    <div className="max-w-3xl">
      <h1 className={almH1}>Search</h1>
      <form method="get" action={href(ctx, "/search")} role="search" className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">Search the guide</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Places, events, articles" className={`min-w-0 flex-1 ${input} px-3 py-2`} />
        <label htmlFor="kind" className="sr-only">Type</label>
        <select id="kind" name="kind" defaultValue={kind} className={`${input} px-2 py-2`}>
          <option value="">Everything</option>
          <option value="place">Places</option>
          <option value="event">Events</option>
          <option value="article">Articles</option>
          <option value="page">Pages</option>
        </select>
        <button type="submit" className={almanacStyle.buttonPrimary}>Search</button>
        {q ? <a href={href(ctx, "/search")} className="self-center text-sm underline">Clear</a> : null}
      </form>
      <div className="mt-6" aria-live="polite">
        {q && results.length === 0 ? (
          <p className={emptyBox}>No results for “{q}”. Try a shorter word, a category name, or browse the <a href={href(ctx, "/places")} className="text-(--section-accent) underline">directory</a>.</p>
        ) : null}
        {results.length ? (
          <ol className="divide-y divide-(--section-border) border-y border-(--section-border)">
            {results.map((r, i) => (
              <li key={r.path} className="grid grid-cols-[2.25rem_1fr] py-3">
                <p className="text-xs tabular-nums text-(--section-accent)">{String(i + 1).padStart(2, "0")}</p>
                <div>
                  <p className={almEyebrow}>{r.kindLabel}{r.meta ? ` · ${r.meta}` : ""}</p>
                  <a href={href(ctx, r.path)} className="font-(family-name:--font-heading) text-xl font-bold tracking-tight hover:underline">{r.title}</a>
                  {r.snippet ? <p className="text-sm text-(--section-muted)">{r.snippet}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        {q ? <p className="mt-3 text-xs text-(--section-muted)">{results.length} result{results.length === 1 ? "" : "s"}</p> : null}
      </div>
    </div>
  );
}

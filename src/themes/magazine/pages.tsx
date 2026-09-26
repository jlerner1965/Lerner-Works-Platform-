import type { RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { SnapshotItem } from "@/server/publishing/snapshot";
import type { ContentKind } from "@/modules/registry";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { featuredImage, itemPath } from "@/themes/shared/collections";
import { indexCopy } from "@/themes/shared/site-root";
import { MagazineCollection, MagazineHeading, magazineStyle, kicker } from "@/themes/magazine/index";
import { formatEventDate, formatEventTimeRange, formatDateOnly, classifyEvent } from "@/lib/events";
import { formatWeeklyHours } from "@/lib/hours";
import type { WeeklyHours } from "@/modules/common";
import { searchSnapshot } from "@/server/publishing/search";
import type { Block } from "@/lib/richtext";

const display = "font-(family-name:--font-heading) font-bold leading-[1.05] tracking-tight text-(--section-heading)";
const input = "rounded-(--radius) border border-(--brand-border-strong) bg-(--brand-bg) text-(--brand-text)";
const deck = "font-(family-name:--font-heading) text-xl italic leading-relaxed text-(--section-muted)";

/** Boxed facts panel used in sidebars. */
function FactsPanel({ title, items }: { title: string; items: Array<{ term: string; value: React.ReactNode }> }) {
  const shown = items.filter((i) => i.value);
  if (!shown.length) return null;
  return (
    <div className="border-y-2 border-(--section-heading) bg-(--section-panel) px-5 py-4 text-sm text-(--section-panel-fg)">
      <p className={kicker}>{title}</p>
      <dl className="mt-3 space-y-3">
        {shown.map((i) => (
          <div key={i.term}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--section-muted)">{i.term}</dt>
            <dd className="mt-0.5">{i.value}</dd>
          </div>
        ))}
      </dl>
    </div>
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

export function MagazinePlaceDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const img = featuredImage(ctx, item);
  const address = p.address as { line1: string; line2: string; locality: string; region: string; postalCode: string } | undefined;
  const addressText = address && (address.line1 || address.locality) ? [address.line1, address.line2, [address.locality, address.region, address.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ") : String(p.areaDescription ?? "");
  const hours = p.hours as WeeklyHours | null;
  const next = p.nextAction as { label: string; path: string } | undefined;
  return (
    <article>
      <header className="mx-auto max-w-3xl text-center">
        <p className={kicker}>{String(p.category)}</p>
        <h1 className={`mt-2 text-4xl sm:text-5xl ${display}`}>{item.title}</h1>
        {p.summary ? <p className={`mt-4 ${deck}`}>{String(p.summary)}</p> : null}
      </header>
      {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 1408px) 1408px, 100vw" className="mt-8 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
      <div className="mt-10 grid gap-10 md:grid-cols-[2fr_1fr]">
        <div>
          <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="mag-prose mag-dropcap" />
          {next?.label && next.path ? (
            <p className="mt-8">
              <a href={next.path.startsWith("/") ? href(ctx, next.path) : next.path} className={magazineStyle.buttonPrimary} {...(next.path.startsWith("http") ? { rel: "noreferrer" } : {})}>
                {next.label}
              </a>
            </p>
          ) : null}
        </div>
        <aside>
          <FactsPanel
            title="Useful information"
            items={[
              { term: "Where", value: addressText || "Location not published" },
              { term: "Website", value: p.website ? <a href={String(p.website)} rel="noreferrer" className="text-(--section-accent) underline">{String(p.website).replace(/^https?:\/\//, "")}</a> : null },
              { term: "Phone", value: String(p.phone ?? "") },
              { term: "Hours", value: hours ? <HoursList hours={hours} /> : <span>Hours not published — check before visiting.</span> },
              { term: "Verified", value: p.lastVerifiedOn ? formatDateOnly(String(p.lastVerifiedOn)) : "Not yet verified" },
              { term: "Source", value: p.sourceUrl ? <a href={String(p.sourceUrl)} rel="noreferrer" className="underline">{String(p.sourceUrl).replace(/^https?:\/\//, "").slice(0, 40)}</a> : String(p.attribution ?? "") },
            ]}
          />
          <p className="mt-4 text-sm"><a href={href(ctx, "/places")} className="text-(--section-accent) underline">← All places</a></p>
        </aside>
      </div>
    </article>
  );
}

export function MagazineEventDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
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
  const mon = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: tz }).format(start);
  return (
    <article className="mx-auto max-w-3xl">
      <header className="grid gap-6 border-y-2 border-(--section-heading) py-6 sm:grid-cols-[8rem_1fr] sm:items-center">
        <div className="text-center sm:border-r-2 sm:border-(--section-accent) sm:pr-6">
          <p className={kicker}>{mon}</p>
          <p className="font-(family-name:--font-heading) text-6xl font-bold leading-none">{day}</p>
        </div>
        <div>
          <p className={kicker}>Event · {phase === "past" ? "Past event" : phase === "in_progress" ? "Happening now" : "Upcoming"}</p>
          <h1 className={`mt-1 text-3xl sm:text-4xl ${display}`}>{item.title}</h1>
        </div>
      </header>
      {p.status === "cancelled" ? (
        <p role="status" className="mt-4 rounded-(--radius) border-l-4 border-(--brand-danger) bg-(--brand-danger-soft) px-4 py-2 font-semibold text-(--brand-danger)">This event has been cancelled.</p>
      ) : p.status === "postponed" ? (
        <p role="status" className="mt-4 rounded-(--radius) border-l-4 border-(--section-accent) bg-(--section-panel) px-4 py-2 font-semibold text-(--section-panel-fg)">This event has been postponed. Check back for a new date.</p>
      ) : null}
      <dl className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        {[
          { term: "When", value: `${formatEventDate(startsAt, tz)}, ${formatEventTimeRange(startsAt, endsAt, tz)}` },
          { term: "Where", value: venue ? (venuePath ? <a href={href(ctx, venuePath)} className="text-(--section-accent) underline">{venue.title}</a> : venue.title) : String(p.venueText ?? "") },
          { term: "Organizer", value: p.organizerUrl ? <a href={String(p.organizerUrl)} rel="noreferrer" className="underline">{String(p.organizerName)}</a> : String(p.organizerName ?? "") },
          { term: "Admission", value: String(p.admission ?? "") },
          { term: "Details", value: p.eventUrl ? <a href={String(p.eventUrl)} rel="noreferrer" className="underline">Event website</a> : null },
        ].filter((i) => i.value).map((i) => (
          <div key={i.term}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--section-muted)">{i.term}</dt>
            <dd className="mt-0.5">{i.value}</dd>
          </div>
        ))}
      </dl>
      {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 720px, 100vw" className="mt-8 aspect-[16/9] w-full rounded-(--radius) object-cover" /> : null}
      {p.summary ? <p className={`mt-8 ${deck}`}>{String(p.summary)}</p> : null}
      <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="mag-prose mt-6" />
      <p className="mt-10 text-sm"><a href={href(ctx, "/events")} className="text-(--section-accent) underline">← All events</a></p>
    </article>
  );
}

export function MagazineArticleDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const img = featuredImage(ctx, item);
  const routed = new Set(ctx.snapshot.routes.filter((r) => r.itemId).map((r) => r.itemId));
  const more = Object.values(ctx.snapshot.items)
    .filter((i) => i.kind === "article" && i.id !== item.id && routed.has(i.id))
    .sort((a, b) => String(b.payload.publishedOn).localeCompare(String(a.payload.publishedOn)))
    .slice(0, 4);
  return (
    <article>
      <header className="mx-auto max-w-3xl text-center">
        <p className={kicker}>Article</p>
        <h1 className={`mt-2 text-4xl sm:text-5xl ${display}`}>{item.title}</h1>
        {p.summary ? <p className={`mt-5 ${deck}`}>{String(p.summary)}</p> : null}
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--section-muted)">
          By {String(p.authorName)} · {formatDateOnly(String(p.publishedOn))}
          {p.updatedOn ? ` · Updated ${formatDateOnly(String(p.updatedOn))}` : ""}
        </p>
      </header>
      {img ? (
        <figure className="mt-8">
          <Picture ctx={ctx} media={img} sizes="(min-width: 1408px) 1408px, 100vw" className="aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" />
          {img.attribution ? <figcaption className="mt-2 text-center text-xs text-(--section-muted)">{img.attribution}</figcaption> : null}
        </figure>
      ) : null}
      <div className="mt-10 grid gap-10 md:grid-cols-[2fr_1fr]">
        <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="mag-prose mag-dropcap" />
        <aside>
          {more.length ? (
            <div className="border-t-2 border-(--section-heading) pt-3">
              <p className={kicker}>More from the guide</p>
              <ul className="mt-3 divide-y divide-(--section-border)">
                {more.map((a) => {
                  const path = itemPath(ctx, a);
                  return (
                    <li key={a.id} className="py-3">
                      <p className="font-(family-name:--font-heading) text-lg font-bold leading-snug">{path ? <a href={href(ctx, path)} className="hover:underline">{a.title}</a> : a.title}</p>
                      <p className="mt-0.5 text-xs text-(--section-muted)">{formatDateOnly(String(a.payload.publishedOn))}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <p className="mt-6 text-sm"><a href={href(ctx, "/articles")} className="text-(--section-accent) underline">← All articles</a></p>
        </aside>
      </div>
    </article>
  );
}

/** Theme defaults for listing pages; owners override them in Settings → Listing pages. */
const indexDefaults: Partial<Record<ContentKind, { title: string; intro: string }>> = {
  place: { title: "Directory", intro: "Places listed in the guide, with verification dates so you know how current the details are." },
  event: { title: "Events", intro: "Upcoming community events. Cancelled events stay listed so nobody shows up to an empty room." },
  article: { title: "Articles", intro: "Short pieces from the guide." },
};

const chip = "rounded-(--radius) border px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.12em]";
const chipActive = "border-(--brand-primary) bg-(--brand-primary) text-(--brand-on-primary)";
const chipIdle = "border-(--brand-border-strong) hover:border-(--brand-primary)";

export function MagazineIndex({ ctx, kind }: { ctx: RenderContext; kind: ContentKind }) {
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
      <header className="mx-auto max-w-3xl text-center">
        <h1 className={`text-4xl sm:text-5xl ${display}`}>{meta.title}</h1>
        {meta.intro ? <p className={`mt-4 ${deck}`}>{meta.intro}</p> : null}
      </header>
      {kind === "place" && categories.length ? (
        <nav aria-label="Filter by category" className="mt-8 flex flex-wrap justify-center gap-2">
          <a href={href(ctx, "/places")} className={`${chip} ${!q.category ? chipActive : chipIdle}`} aria-current={!q.category ? "page" : undefined}>All ({total})</a>
          {categories.map((c) => (
            <a key={c} href={`${href(ctx, "/places")}?category=${encodeURIComponent(c)}`} className={`${chip} ${q.category === c ? chipActive : chipIdle}`} aria-current={q.category === c ? "page" : undefined}>{c}</a>
          ))}
        </nav>
      ) : null}
      {kind === "event" ? (
        <form method="get" action={href(ctx, "/events")} className="mt-8 flex flex-wrap items-end justify-center gap-3 border-y-2 border-(--section-heading) py-3 text-sm">
          <fieldset className="flex gap-2">
            <legend className="sr-only">Show</legend>
            <a href={href(ctx, "/events")} className={`${chip} ${q.show !== "past" ? chipActive : chipIdle}`} aria-current={q.show !== "past" ? "page" : undefined}>Upcoming</a>
            <a href={`${href(ctx, "/events")}?show=past`} className={`${chip} ${q.show === "past" ? chipActive : chipIdle}`} aria-current={q.show === "past" ? "page" : undefined}>Past</a>
          </fieldset>
          {q.show === "past" ? <input type="hidden" name="show" value="past" /> : null}
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-[0.14em]">From<input type="date" name="from" defaultValue={q.from ?? ""} className={`${input} px-2 py-1 text-sm font-normal normal-case tracking-normal`} /></label>
          <label className="flex flex-col text-[11px] font-semibold uppercase tracking-[0.14em]">To<input type="date" name="to" defaultValue={q.to ?? ""} className={`${input} px-2 py-1 text-sm font-normal normal-case tracking-normal`} /></label>
          <button type="submit" className={magazineStyle.buttonPrimary}>Apply dates</button>
          {filtersActive ? <a href={href(ctx, "/events")} className="underline">Reset filters</a> : null}
        </form>
      ) : null}
      <div className="mt-10">
        {items.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-(--radius) border border-dashed border-(--brand-border-strong) p-6 text-center">
            <p className="font-semibold">{filtersActive ? "Nothing matches these filters." : `Nothing has been published in ${meta.title.toLowerCase()} yet.`}</p>
            {filtersActive ? <p className="mt-1 text-sm"><a href={href(ctx, kind === "place" ? "/places" : "/events")} className="text-(--section-accent) underline">Clear filters</a> to see everything.</p> : null}
          </div>
        ) : (
          <MagazineCollection ctx={ctx} kind={kind} items={items} mode="latest" variant={kind === "article" ? "featured" : "default"} />
        )}
      </div>
    </div>
  );
}

export function MagazineSearch({ ctx }: { ctx: RenderContext }) {
  const q = (ctx.query.q ?? "").trim();
  const kind = ctx.query.kind ?? "";
  const results = q ? searchSnapshot(ctx.snapshot, { query: q, kind: kind || undefined, now: ctx.now }) : [];
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className={`text-center text-4xl ${display}`}>Search</h1>
      <form method="get" action={href(ctx, "/search")} role="search" className="mt-6 flex flex-wrap gap-2">
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
        <button type="submit" className={magazineStyle.buttonPrimary}>Search</button>
        {q ? <a href={href(ctx, "/search")} className="self-center text-sm underline">Clear</a> : null}
      </form>
      <div className="mt-8" aria-live="polite">
        {q && results.length === 0 ? (
          <p className="rounded-(--radius) border border-dashed border-(--brand-border-strong) p-6 text-center">No results for “{q}”. Try a shorter word, a category name, or browse the <a href={href(ctx, "/places")} className="text-(--section-accent) underline">directory</a>.</p>
        ) : null}
        {results.length ? (
          <>
            <MagazineHeading>{results.length} result{results.length === 1 ? "" : "s"}</MagazineHeading>
            <ol className="divide-y divide-(--section-border)">
              {results.map((r) => (
                <li key={r.path} className="py-4">
                  <p className={kicker}>{r.kindLabel}{r.meta ? ` · ${r.meta}` : ""}</p>
                  <a href={href(ctx, r.path)} className="mt-1 inline-block font-(family-name:--font-heading) text-2xl font-bold leading-snug hover:underline">{r.title}</a>
                  {r.snippet ? <p className="mt-1 text-sm text-(--section-muted)">{r.snippet}</p> : null}
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </div>
  );
}

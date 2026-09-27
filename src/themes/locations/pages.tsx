import type { RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { SnapshotItem } from "@/server/publishing/snapshot";
import type { ContentKind } from "@/modules/registry";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { InquiryForm } from "@/themes/shared/inquiry-form";
import { featuredImage, itemPath } from "@/themes/shared/collections";
import { indexCopy, inquiriesEnabled } from "@/themes/shared/site-root";
import { LocRule, StoreCard, StoreStatus, locFormStyles, outlineButton, locationsStyle } from "@/themes/locations/index";
import { Attachments } from "@/themes/shared/documents";
import { formatWeeklyHours, formatInterval, upcomingExceptions } from "@/lib/hours";
import { formatDateOnly } from "@/lib/events";
import type { HoursException, WeeklyHours } from "@/modules/common";
import { searchSnapshot } from "@/server/publishing/search";
import type { Block } from "@/lib/richtext";

const h1 = "text-4xl font-extrabold uppercase tracking-tight text-(--section-heading)";
const eyebrow = "text-xs font-bold uppercase tracking-wide text-(--section-muted)";
const select = "mt-1 rounded-(--radius) border border-(--brand-border-strong) bg-(--brand-bg) px-2 py-2 font-normal normal-case tracking-normal text-(--brand-text)";
const emptyBox = "rounded-(--radius) border border-dashed border-(--brand-border-strong) p-6";
const rule = "border-t-4 border-(--section-heading)";

export function LocationsStoreDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const a = p.address as { line1: string; line2: string; locality: string; region: string; postalCode: string; approved: boolean };
  const hours = p.weeklyHours as WeeklyHours | null;
  const exceptions = (p.exceptions as HoursException[]) ?? [];
  const upcoming = upcomingExceptions(exceptions, ctx.now, String(p.timeZone));
  const services = ((p.serviceItemIds as string[]) ?? []).map((id) => ctx.snapshot.items[id]).filter((s): s is SnapshotItem => Boolean(s));
  const img = featuredImage(ctx, item);
  const status = p.status as string;
  const canDirections = ctx.mode === "live" && a.approved;
  const addressLine = [a.line1, a.line2].filter(Boolean).join(", ");
  const cityLine = [a.locality, a.region, a.postalCode].filter(Boolean).join(" ");
  return (
    <article>
      <div className="grid gap-8 md:grid-cols-[3fr_2fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-(--section-accent)">Store</p>
          <h1 className={`mt-1 ${h1}`}>{item.title}</h1>
          {status !== "open" ? (
            <p role="status" className="mt-3 rounded-(--radius) border-l-4 border-(--brand-danger) bg-(--brand-danger-soft) px-4 py-2 font-bold text-(--brand-danger)">
              {status === "temporarily_closed" ? "Temporarily closed" : "Permanently closed"}{p.statusNote ? ` — ${String(p.statusNote)}` : ""}
            </p>
          ) : null}
          <div className={`mt-4 ${rule} pt-4`}>
            <p className={eyebrow}>Address</p>
            <p className="mt-1 text-lg">{addressLine}<br />{cityLine}</p>
            {canDirections ? (
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${addressLine}, ${cityLine}`)}`} rel="noreferrer" className={`mt-2 ${outlineButton}`}>Directions</a>
            ) : (
              <p className="mt-2 text-sm text-(--section-muted)">
                <span className="inline-block rounded-(--radius) border border-(--brand-border-strong) px-3 py-1 text-(--section-muted)" aria-disabled="true">Directions unavailable</span>{" "}
                {ctx.mode !== "live" ? "This is a demonstration address; directions are disabled because the location is fictional." : "Directions are enabled once the owner approves this address."}
              </p>
            )}
            {p.phone ? <p className="mt-3"><span className={eyebrow}>Phone</span><br /><a href={`tel:${String(p.phone).replace(/[^\d+]/g, "")}`} className="text-lg underline">{String(p.phone)}</a></p> : null}
          </div>
          <div className={`mt-6 ${rule} pt-4`}>
            <p className={eyebrow}>Hours</p>
            <div className="mt-1"><StoreStatus ctx={ctx} item={item} /></div>
            {hours ? (
              <table className="mt-3 w-full max-w-sm text-sm">
                <caption className="sr-only">Regular weekly hours</caption>
                <tbody>
                  {formatWeeklyHours(hours).map((row) => (
                    <tr key={row.day} className="border-b border-(--section-border)"><th scope="row" className="py-1 pr-4 text-left font-semibold">{row.day}</th><td className="py-1">{row.text}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-sm">Regular hours are not published for this store. Call ahead before visiting.</p>
            )}
            {upcoming.length ? (
              <div className="mt-4">
                <p className={eyebrow}>Upcoming exceptions</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {upcoming.map((e) => (
                    <li key={e.date}><strong>{formatDateOnly(e.date)}</strong>{e.label ? ` (${e.label})` : ""}: {e.closed ? "Closed" : e.intervals.map(formatInterval).join(", ")}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          {services.length ? (
            <div className={`mt-6 ${rule} pt-4`}>
              <p className={eyebrow}>Services at this store</p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {services.map((s) => {
                  const sp = itemPath(ctx, s);
                  return <li key={s.id} className="rounded-(--radius) border border-(--section-border) p-3"><p className="font-bold uppercase tracking-wide">{sp ? <a href={href(ctx, sp)} className="hover:underline">{s.title}</a> : s.title}</p>{s.payload.summary ? <p className="mt-1 text-sm">{String(s.payload.summary)}</p> : null}</li>;
                })}
              </ul>
            </div>
          ) : null}
          <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="loc-prose mt-6" />
          <Attachments ctx={ctx} item={item} style={locationsStyle} />
        </div>
        <div>
          {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/3] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
          {inquiriesEnabled(ctx) ? (
            <div className="mt-6">
              <InquiryForm endpoint={ctx.inquiryEndpoint} heading={`Ask ${item.title}`} intro="" sourcePath={ctx.path} locations={[{ id: item.id, label: item.title }]} locationId={item.id} styles={locFormStyles} />
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-8 text-sm"><a href={href(ctx, "/locations")} className="underline">← All locations</a></p>
    </article>
  );
}

export function LocationsServiceDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const stores = Object.values(ctx.snapshot.items).filter((s) => s.kind === "store" && ((s.payload.serviceItemIds as string[]) ?? []).includes(item.id)).sort((a, b) => a.title.localeCompare(b.title));
  const img = featuredImage(ctx, item);
  return (
    <article>
      <p className="text-xs font-bold uppercase tracking-wide text-(--section-accent)">Service</p>
      <h1 className={`mt-1 ${h1}`}>{item.title}</h1>
      {p.summary ? <p className="mt-3 max-w-2xl text-lg">{String(p.summary)}</p> : null}
      {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 720px, 100vw" className="mt-6 aspect-[16/9] w-full max-w-3xl rounded-(--radius) object-cover" /> : null}
      <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="loc-prose mt-6 max-w-3xl" />
      <Attachments ctx={ctx} item={item} style={locationsStyle} className="mt-10 max-w-3xl" />
      <section className="mt-10">
        <LocRule>Available at</LocRule>
        {stores.length === 0 ? <p className="text-(--section-muted)">No published store currently lists this service.</p> : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stores.map((s) => <li key={s.id}><StoreCard ctx={ctx} item={s} /></li>)}</ul>
        )}
      </section>
      {p.inquiryPrompt && inquiriesEnabled(ctx) ? <p className="mt-8 rounded-(--radius) border-l-4 border-(--section-accent) bg-(--section-panel) px-4 py-3 text-(--section-panel-fg)">{String(p.inquiryPrompt)} <a href={href(ctx, "/contact")} className="font-bold underline">Send an inquiry</a>.</p> : null}
      <p className="mt-8 text-sm"><a href={href(ctx, "/services")} className="underline">← All services</a></p>
    </article>
  );
}

export function LocationsIndex({ ctx, kind }: { ctx: RenderContext; kind: ContentKind }) {
  const routed = new Set(ctx.snapshot.routes.filter((r) => r.itemId).map((r) => r.itemId));
  let items = Object.values(ctx.snapshot.items).filter((i) => i.kind === kind && routed.has(i.id)).sort((a, b) => a.title.localeCompare(b.title));
  const q = ctx.query;
  if (kind === "store") {
    const localities = [...new Set(items.map((i) => String((i.payload.address as { locality: string }).locality)).filter(Boolean))].sort();
    const services = Object.values(ctx.snapshot.items).filter((i) => i.kind === "service" && routed.has(i.id)).sort((a, b) => a.title.localeCompare(b.title));
    const total = items.length;
    if (q.locality) items = items.filter((i) => String((i.payload.address as { locality: string }).locality) === q.locality);
    if (q.service) items = items.filter((i) => ((i.payload.serviceItemIds as string[]) ?? []).includes(q.service!));
    const active = Boolean(q.locality || q.service);
    const copy = indexCopy(ctx, "store", { title: "Locations", intro: `${total} store${total === 1 ? "" : "s"}. Filter by city or by the service you need.` });
    return (
      <div>
        <h1 className={h1}>{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-lg">{copy.intro}</p>
        <form method="get" action={href(ctx, "/locations")} className="mt-6 flex flex-wrap items-end gap-3 border-y-4 border-(--section-heading) py-4 text-sm">
          <label className="flex flex-col font-bold uppercase tracking-wide">City
            <select name="locality" defaultValue={q.locality ?? ""} className={select}>
              <option value="">All cities</option>
              {localities.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col font-bold uppercase tracking-wide">Service
            <select name="service" defaultValue={q.service ?? ""} className={select}>
              <option value="">Any service</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <button type="submit" className="rounded-(--radius) bg-(--brand-primary) px-4 py-2 font-bold uppercase tracking-wide text-(--brand-on-primary)">Filter</button>
          {active ? <a href={href(ctx, "/locations")} className="underline">Reset</a> : null}
        </form>
        <div className="mt-6" aria-live="polite">
          {items.length === 0 ? (
            <div className={emptyBox}><p className="font-bold">No stores match these filters.</p><p className="mt-1 text-sm"><a href={href(ctx, "/locations")} className="underline">Show all stores</a></p></div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((s) => <li key={s.id}><StoreCard ctx={ctx} item={s} /></li>)}</ul>
          )}
        </div>
        <p className="mt-6 text-sm text-(--section-muted)">Looking for a store by distance? Use the city filter; distance sorting is not offered because addresses are only shown, not geocoded.</p>
      </div>
    );
  }
  const copy = indexCopy(ctx, kind, { title: "Services", intro: "What our stores can do for you. Availability varies by location; each service lists the stores that offer it." });
  return (
    <div>
      <h1 className={h1}>{copy.title}</h1>
      {copy.intro ? <p className="mt-2 max-w-2xl text-lg">{copy.intro}</p> : null}
      <div className="mt-6">
        {items.length === 0 ? <p className={`${emptyBox} text-(--section-muted)`}>No services have been published yet.</p> : (
          <ul className="grid gap-px rounded-(--radius) bg-(--section-border) sm:grid-cols-2">
            {items.map((it) => {
              const p = itemPath(ctx, it);
              const count = Object.values(ctx.snapshot.items).filter((s) => s.kind === "store" && ((s.payload.serviceItemIds as string[]) ?? []).includes(it.id)).length;
              return (
                <li key={it.id} className="bg-(--section-bg) p-5">
                  <h2 className="text-lg font-extrabold uppercase tracking-wide">{p ? <a href={href(ctx, p)} className="hover:underline">{it.title}</a> : it.title}</h2>
                  {it.payload.summary ? <p className="mt-2">{String(it.payload.summary)}</p> : null}
                  <p className={`mt-2 ${eyebrow}`}>{count === 0 ? "Not currently offered at a published store" : `${count} store${count === 1 ? "" : "s"}`}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function LocationsSearch({ ctx }: { ctx: RenderContext }) {
  const q = (ctx.query.q ?? "").trim();
  const results = q ? searchSnapshot(ctx.snapshot, { query: q, now: ctx.now }) : [];
  return (
    <div className="max-w-3xl">
      <h1 className={h1}>Search</h1>
      <form method="get" action={href(ctx, "/search")} role="search" className="mt-4 flex gap-2">
        <label htmlFor="q" className="sr-only">Search stores and services</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Store, city or service" className="min-w-0 flex-1 rounded-(--radius) border border-(--brand-border-strong) bg-(--brand-bg) px-3 py-2 text-(--brand-text)" />
        <button type="submit" className="rounded-(--radius) bg-(--brand-primary) px-4 py-2 font-bold uppercase tracking-wide text-(--brand-on-primary)">Search</button>
        {q ? <a href={href(ctx, "/search")} className="self-center text-sm underline">Clear</a> : null}
      </form>
      <div className="mt-6" aria-live="polite">
        {q && results.length === 0 ? <p className={emptyBox}>No results for “{q}”. Try a city name or browse <a href={href(ctx, "/locations")} className="underline">all locations</a>.</p> : null}
        {results.length ? (
          <ol className="divide-y divide-(--section-border) border-t-4 border-(--section-heading)">
            {results.map((r) => (
              <li key={r.path} className="py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-(--section-accent)">{r.kindLabel}{r.meta ? ` · ${r.meta}` : ""}</p>
                <a href={href(ctx, r.path)} className="text-lg font-extrabold uppercase tracking-wide hover:underline">{r.title}</a>
                {r.snippet ? <p className="text-sm">{r.snippet}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}
        {q ? <p className="mt-3 text-xs text-(--section-muted)">{results.length} result{results.length === 1 ? "" : "s"}</p> : null}
      </div>
    </div>
  );
}

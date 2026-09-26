import type { RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { SnapshotItem } from "@/server/publishing/snapshot";
import type { ContentKind } from "@/modules/registry";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { InquiryForm } from "@/themes/shared/inquiry-form";
import { featuredImage, itemPath } from "@/themes/shared/collections";
import { indexCopy, inquiriesEnabled } from "@/themes/shared/site-root";
import { PracticeHeading, LocationCard, LocationStatus, pracFormStyles, pracEyebrow, pracPanel, pracOutline, pracH1, practiceStyle } from "@/themes/practice/index";
import { formatWeeklyHours, formatInterval, upcomingExceptions } from "@/lib/hours";
import { formatDateOnly } from "@/lib/events";
import type { HoursException, WeeklyHours } from "@/modules/common";
import { searchSnapshot } from "@/server/publishing/search";
import type { Block } from "@/lib/richtext";

const select = "mt-1 rounded-(--radius) border border-(--brand-border-strong) bg-(--brand-bg) px-2 py-2 font-normal text-(--brand-text)";
const emptyBox = "rounded-(--radius) border border-dashed border-(--brand-border-strong) p-6";

export function PracticeStoreDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
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
      <div className="grid gap-10 md:grid-cols-[3fr_2fr]">
        <div>
          <p className={pracEyebrow}>Location · {a.locality}</p>
          <h1 className={`mt-1 ${pracH1}`}>{item.title}</h1>
          {status !== "open" ? (
            <p role="status" className="mt-4 rounded-(--radius) border-l-4 border-(--brand-danger) bg-(--brand-danger-soft) px-4 py-2 font-semibold text-(--brand-danger)">
              {status === "temporarily_closed" ? "Temporarily closed" : "Permanently closed"}{p.statusNote ? ` — ${String(p.statusNote)}` : ""}
            </p>
          ) : null}
          {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 60vw, 100vw" className="mt-6 aspect-[3/2] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
          <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="prac-prose mt-6" />
          {services.length ? (
            <section className="mt-10">
              <PracticeHeading>Services at this location</PracticeHeading>
              <ol className="grid gap-4 sm:grid-cols-2">
                {services.map((s, i) => {
                  const sp = itemPath(ctx, s);
                  return (
                    <li key={s.id} className={`${pracPanel} p-5`}>
                      <p className="font-(family-name:--font-heading) text-2xl font-semibold text-(--section-accent)">{String(i + 1).padStart(2, "0")}</p>
                      <p className="mt-2 font-(family-name:--font-heading) text-lg font-semibold tracking-tight">{sp ? <a href={href(ctx, sp)} className="hover:underline">{s.title}</a> : s.title}</p>
                      {s.payload.summary ? <p className="mt-1 text-sm text-(--section-muted)">{String(s.payload.summary)}</p> : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </div>
        <aside>
          <div className={`${pracPanel} p-6`}>
            <p className={pracEyebrow}>Visit</p>
            <p className="mt-2 text-lg">{addressLine}<br />{cityLine}</p>
            {canDirections ? (
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${addressLine}, ${cityLine}`)}`} rel="noreferrer" className={`mt-3 ${pracOutline}`}>Directions</a>
            ) : (
              <p className="mt-3 text-sm text-(--section-muted)">
                <span className="inline-block rounded-(--radius) border border-(--brand-border-strong) px-3 py-1" aria-disabled="true">Directions unavailable</span>{" "}
                {ctx.mode !== "live" ? "This is a demonstration address; directions are disabled because the location is fictional." : "Directions are enabled once the owner approves this address."}
              </p>
            )}
            {p.phone ? <p className="mt-4"><span className={pracEyebrow}>Phone</span><br /><a href={`tel:${String(p.phone).replace(/[^\d+]/g, "")}`} className="text-lg underline">{String(p.phone)}</a></p> : null}
            <div className="mt-5 border-t border-(--brand-border) pt-4">
              <p className={pracEyebrow}>Hours</p>
              <div className="mt-1"><LocationStatus ctx={ctx} item={item} /></div>
              {hours ? (
                <table className="mt-3 w-full text-sm">
                  <caption className="sr-only">Regular weekly hours</caption>
                  <tbody>
                    {formatWeeklyHours(hours).map((row) => (
                      <tr key={row.day} className="border-b border-(--brand-border)"><th scope="row" className="py-1.5 pr-4 text-left font-semibold">{row.day}</th><td className="py-1.5 tabular-nums">{row.text}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-2 text-sm">Regular hours are not published for this location. Call ahead before visiting.</p>
              )}
              {upcoming.length ? (
                <div className="mt-4">
                  <p className={pracEyebrow}>Upcoming exceptions</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {upcoming.map((e) => (
                      <li key={e.date}><strong>{formatDateOnly(e.date)}</strong>{e.label ? ` (${e.label})` : ""}: {e.closed ? "Closed" : e.intervals.map(formatInterval).join(", ")}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
          {inquiriesEnabled(ctx) ? (
            <div className="mt-6">
              <InquiryForm endpoint={ctx.inquiryEndpoint} heading={`Ask ${item.title}`} intro="" sourcePath={ctx.path} locations={[{ id: item.id, label: item.title }]} locationId={item.id} styles={pracFormStyles} />
            </div>
          ) : null}
        </aside>
      </div>
      <p className="mt-8 text-sm"><a href={href(ctx, "/locations")} className="font-semibold text-(--section-accent) underline">All locations</a></p>
    </article>
  );
}

export function PracticeServiceDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const stores = Object.values(ctx.snapshot.items).filter((s) => s.kind === "store" && ((s.payload.serviceItemIds as string[]) ?? []).includes(item.id)).sort((a, b) => a.title.localeCompare(b.title));
  const img = featuredImage(ctx, item);
  return (
    <article>
      <p className={pracEyebrow}>Service</p>
      <h1 className={`mt-1 ${pracH1}`}>{item.title}</h1>
      {p.summary ? <p className="mt-3 max-w-2xl text-lg text-(--section-muted)">{String(p.summary)}</p> : null}
      {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 720px, 100vw" className="mt-6 aspect-[16/9] w-full max-w-3xl rounded-(--radius) object-cover" /> : null}
      <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="prac-prose mt-6 max-w-3xl" />
      <section className="mt-10">
        <PracticeHeading>Offered at</PracticeHeading>
        {stores.length === 0 ? <p className="text-(--section-muted)">No published location currently offers this service.</p> : (
          <ul className="grid gap-4 sm:grid-cols-2">{stores.map((s) => <li key={s.id}><LocationCard ctx={ctx} item={s} /></li>)}</ul>
        )}
      </section>
      {p.inquiryPrompt && inquiriesEnabled(ctx) ? <p className={`mt-8 ${pracPanel} px-5 py-4`}>{String(p.inquiryPrompt)} <a href={href(ctx, "/contact")} className="font-semibold underline">Send an inquiry</a>.</p> : null}
      <p className="mt-8 text-sm"><a href={href(ctx, "/services")} className="font-semibold text-(--section-accent) underline">All services</a></p>
    </article>
  );
}

export function PracticeIndex({ ctx, kind }: { ctx: RenderContext; kind: ContentKind }) {
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
    const copy = indexCopy(ctx, "store", { title: "Locations", intro: `${total} location${total === 1 ? "" : "s"}. Filter by city or by the service you need.` });
    return (
      <div>
        <h1 className={pracH1}>{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-lg text-(--section-muted)">{copy.intro}</p>
        <form method="get" action={href(ctx, "/locations")} className={`mt-6 flex flex-wrap items-end gap-3 ${pracPanel} p-4 text-sm`}>
          <label className="flex flex-col font-semibold">City
            <select name="locality" defaultValue={q.locality ?? ""} className={select}>
              <option value="">All cities</option>
              {localities.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col font-semibold">Service
            <select name="service" defaultValue={q.service ?? ""} className={select}>
              <option value="">Any service</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <button type="submit" className={practiceStyle.buttonPrimary}>Filter</button>
          {active ? <a href={href(ctx, "/locations")} className="underline">Reset</a> : null}
        </form>
        <div className="mt-6" aria-live="polite">
          {items.length === 0 ? (
            <div className={emptyBox}><p className="font-semibold">No locations match these filters.</p><p className="mt-1 text-sm"><a href={href(ctx, "/locations")} className="underline">Show all locations</a></p></div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">{items.map((s) => <li key={s.id}><LocationCard ctx={ctx} item={s} /></li>)}</ul>
          )}
        </div>
        <p className="mt-6 text-sm text-(--section-muted)">Looking for a location by distance? Use the city filter; distance sorting is not offered because addresses are only shown, not geocoded.</p>
      </div>
    );
  }
  const copy = indexCopy(ctx, kind, { title: "Services", intro: "What we can do for you. Availability varies by location; each service lists the locations that offer it." });
  return (
    <div>
      <h1 className={pracH1}>{copy.title}</h1>
      {copy.intro ? <p className="mt-2 max-w-2xl text-lg text-(--section-muted)">{copy.intro}</p> : null}
      <div className="mt-6">
        {items.length === 0 ? <p className={`${emptyBox} text-(--section-muted)`}>No services have been published yet.</p> : (
          <ol className="grid gap-4 sm:grid-cols-2">
            {items.map((it, i) => {
              const p = itemPath(ctx, it);
              const count = Object.values(ctx.snapshot.items).filter((s) => s.kind === "store" && ((s.payload.serviceItemIds as string[]) ?? []).includes(it.id)).length;
              return (
                <li key={it.id} className={`${pracPanel} p-5`}>
                  <p className="font-(family-name:--font-heading) text-2xl font-semibold text-(--section-accent)">{String(i + 1).padStart(2, "0")}</p>
                  <h2 className="mt-2 font-(family-name:--font-heading) text-xl font-semibold tracking-tight">{p ? <a href={href(ctx, p)} className="hover:underline">{it.title}</a> : it.title}</h2>
                  {it.payload.summary ? <p className="mt-2 text-sm text-(--section-muted)">{String(it.payload.summary)}</p> : null}
                  <p className={`mt-3 ${pracEyebrow}`}>{count === 0 ? "Not currently offered at a published location" : `${count} location${count === 1 ? "" : "s"}`}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

export function PracticeSearch({ ctx }: { ctx: RenderContext }) {
  const q = (ctx.query.q ?? "").trim();
  const results = q ? searchSnapshot(ctx.snapshot, { query: q, now: ctx.now }) : [];
  return (
    <div className="max-w-3xl">
      <h1 className={pracH1}>Search</h1>
      <form method="get" action={href(ctx, "/search")} role="search" className="mt-4 flex gap-2">
        <label htmlFor="q" className="sr-only">Search locations and services</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Location, city or service" className="min-w-0 flex-1 rounded-(--radius) border border-(--brand-border-strong) bg-(--brand-bg) px-3 py-2 text-(--brand-text)" />
        <button type="submit" className={practiceStyle.buttonPrimary}>Search</button>
        {q ? <a href={href(ctx, "/search")} className="self-center text-sm underline">Clear</a> : null}
      </form>
      <div className="mt-6" aria-live="polite">
        {q && results.length === 0 ? <p className={emptyBox}>No results for “{q}”. Try a city name or browse <a href={href(ctx, "/locations")} className="underline">all locations</a>.</p> : null}
        {results.length ? (
          <ol className="divide-y divide-(--section-border)">
            {results.map((r) => (
              <li key={r.path} className="py-4">
                <p className={pracEyebrow}>{r.kindLabel}{r.meta ? ` · ${r.meta}` : ""}</p>
                <a href={href(ctx, r.path)} className="font-(family-name:--font-heading) text-xl font-semibold tracking-tight hover:underline">{r.title}</a>
                {r.snippet ? <p className="text-sm text-(--section-muted)">{r.snippet}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}
        {q ? <p className="mt-3 text-xs text-(--section-muted)">{results.length} result{results.length === 1 ? "" : "s"}</p> : null}
      </div>
    </div>
  );
}

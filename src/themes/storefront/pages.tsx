import type { RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { SnapshotItem } from "@/server/publishing/snapshot";
import type { ContentKind } from "@/modules/registry";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { InquiryForm } from "@/themes/shared/inquiry-form";
import { featuredImage, itemPath } from "@/themes/shared/collections";
import { indexCopy, inquiriesEnabled } from "@/themes/shared/site-root";
import { StoreHeading, StoreTile, StatusBadge, storeFormStyles, storeOutlineButton, storeEyebrow, StorefrontCollection, storefrontStyle } from "@/themes/storefront/index";
import { Attachments } from "@/themes/shared/documents";
import { formatWeeklyHours, formatInterval, upcomingExceptions } from "@/lib/hours";
import { formatDateOnly } from "@/lib/events";
import type { HoursException, WeeklyHours } from "@/modules/common";
import { searchSnapshot } from "@/server/publishing/search";
import type { Block } from "@/lib/richtext";

const display = "font-extrabold uppercase leading-[0.95] tracking-tight text-(--section-heading)";
const select = "mt-1 rounded-(--radius) border-2 border-(--brand-border-strong) bg-(--brand-bg) px-2 py-2 font-normal normal-case tracking-normal text-(--brand-text)";
const emptyBox = "rounded-(--radius) border-2 border-dashed border-(--brand-border-strong) p-6";
const darkStrip = "rounded-(--radius) bg-(--brand-text) px-6 py-6 text-(--brand-on-text)";

export function StorefrontStoreDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
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
      {/* Status strip: what a visitor decides on first. */}
      <div className={`${darkStrip} grid gap-4 md:grid-cols-[1fr_auto] md:items-end`}>
        <div>
          <p className="border-l-4 border-(--brand-accent) pl-2 text-xs font-extrabold uppercase tracking-[0.14em]">{a.locality || "Store"}</p>
          <h1 className={`mt-1 text-4xl sm:text-6xl ${display}`} style={{ color: "var(--brand-on-text)" }}>{item.title}</h1>
          <p className="mt-3 text-sm">{addressLine}{addressLine && cityLine ? " · " : ""}{cityLine}</p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <StatusBadge ctx={ctx} item={item} />
          {p.phone ? <a href={`tel:${String(p.phone).replace(/[^\d+]/g, "")}`} className="text-lg font-extrabold underline">{String(p.phone)}</a> : null}
        </div>
      </div>
      {status !== "open" ? (
        <p role="status" className="mt-4 rounded-(--radius) border-l-8 border-(--brand-danger) bg-(--brand-danger-soft) px-4 py-3 font-bold text-(--brand-danger)">
          {status === "temporarily_closed" ? "Temporarily closed" : "Permanently closed"}{p.statusNote ? ` — ${String(p.statusNote)}` : ""}
        </p>
      ) : null}
      <div className="mt-8 grid gap-8 md:grid-cols-[3fr_2fr]">
        <div>
          {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 60vw, 100vw" className="aspect-[3/2] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
          <section className="mt-8">
            <StoreHeading>Hours</StoreHeading>
            {hours ? (
              <table className="w-full max-w-md text-sm">
                <caption className="sr-only">Regular weekly hours</caption>
                <tbody>
                  {formatWeeklyHours(hours).map((row) => (
                    <tr key={row.day} className="border-b-2 border-(--section-border)"><th scope="row" className="py-2 pr-4 text-left font-extrabold uppercase tracking-wide">{row.day}</th><td className="py-2">{row.text}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm">Regular hours are not published for this store. Call ahead before visiting.</p>
            )}
            {upcoming.length ? (
              <div className="mt-4">
                <p className={storeEyebrow}>Upcoming exceptions</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {upcoming.map((e) => (
                    <li key={e.date}><strong>{formatDateOnly(e.date)}</strong>{e.label ? ` (${e.label})` : ""}: {e.closed ? "Closed" : e.intervals.map(formatInterval).join(", ")}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
          <section className="mt-8">
            <StoreHeading>Getting here</StoreHeading>
            <p className="text-lg font-semibold">{addressLine}<br />{cityLine}</p>
            {canDirections ? (
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${addressLine}, ${cityLine}`)}`} rel="noreferrer" className={`mt-3 ${storeOutlineButton}`}>Directions</a>
            ) : (
              <p className="mt-3 text-sm text-(--section-muted)">
                <span className="inline-block rounded-(--radius) border-2 border-(--brand-border-strong) px-3 py-1 text-(--section-muted)" aria-disabled="true">Directions unavailable</span>{" "}
                {ctx.mode !== "live" ? "This is a demonstration address; directions are disabled because the location is fictional." : "Directions are enabled once the owner approves this address."}
              </p>
            )}
          </section>
          {services.length ? (
            <section className="mt-8">
              <StoreHeading>Services at this store</StoreHeading>
              <StorefrontCollection ctx={ctx} items={services} variant="text" columns={2} />
            </section>
          ) : null}
          <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="store-prose mt-8" />
          <Attachments ctx={ctx} item={item} style={storefrontStyle} />
        </div>
        <div>
          {inquiriesEnabled(ctx) ? (
            <InquiryForm endpoint={ctx.inquiryEndpoint} heading={`Ask ${item.title}`} intro="" sourcePath={ctx.path} locations={[{ id: item.id, label: item.title }]} locationId={item.id} styles={storeFormStyles} />
          ) : null}
        </div>
      </div>
      <p className="mt-8 text-sm"><a href={href(ctx, "/locations")} className="font-bold underline">← All locations</a></p>
    </article>
  );
}

export function StorefrontServiceDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const stores = Object.values(ctx.snapshot.items).filter((s) => s.kind === "store" && ((s.payload.serviceItemIds as string[]) ?? []).includes(item.id)).sort((a, b) => a.title.localeCompare(b.title));
  const img = featuredImage(ctx, item);
  return (
    <article>
      <div className="grid gap-8 md:grid-cols-[3fr_2fr] md:items-center">
        <div className="border-l-8 border-(--section-accent) pl-6">
          <p className={storeEyebrow}>Service</p>
          <h1 className={`mt-1 text-4xl sm:text-6xl ${display}`}>{item.title}</h1>
          {p.summary ? <p className="mt-4 max-w-2xl text-lg font-semibold">{String(p.summary)}</p> : null}
        </div>
        {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/3] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
      </div>
      <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="store-prose mt-8 max-w-3xl" />
      <Attachments ctx={ctx} item={item} style={storefrontStyle} className="mt-10 max-w-3xl" />
      <section className="mt-10">
        <StoreHeading>Available at</StoreHeading>
        {stores.length === 0 ? <p className="text-(--section-muted)">No published store currently lists this service.</p> : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stores.map((s) => <li key={s.id}><StoreTile ctx={ctx} item={s} /></li>)}</ul>
        )}
      </section>
      {p.inquiryPrompt && inquiriesEnabled(ctx) ? <p className="mt-8 rounded-(--radius) bg-(--brand-primary) px-6 py-4 font-semibold text-(--brand-on-primary)">{String(p.inquiryPrompt)} <a href={href(ctx, "/contact")} className="font-extrabold underline">Send an inquiry</a>.</p> : null}
      <p className="mt-8 text-sm"><a href={href(ctx, "/services")} className="font-bold underline">← All services</a></p>
    </article>
  );
}

export function StorefrontIndex({ ctx, kind }: { ctx: RenderContext; kind: ContentKind }) {
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
        <div className={`${darkStrip} md:flex md:items-end md:justify-between md:gap-8`}>
          <div>
            <h1 className={`text-4xl sm:text-6xl ${display}`} style={{ color: "var(--brand-on-text)" }}>{copy.title}</h1>
            <p className="mt-2 max-w-2xl text-lg">{copy.intro}</p>
          </div>
          <form method="get" action={href(ctx, "/locations")} className="mt-6 flex flex-wrap items-end gap-3 text-sm md:mt-0">
            <label className="flex flex-col text-xs font-extrabold uppercase tracking-wide">City
              <select name="locality" defaultValue={q.locality ?? ""} className={select}>
                <option value="">All cities</option>
                {localities.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-xs font-extrabold uppercase tracking-wide">Service
              <select name="service" defaultValue={q.service ?? ""} className={select}>
                <option value="">Any service</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </label>
            <button type="submit" className="rounded-(--radius) bg-(--brand-accent) px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-(--brand-on-accent)">Filter</button>
            {active ? <a href={href(ctx, "/locations")} className="underline">Reset</a> : null}
          </form>
        </div>
        <div className="mt-8" aria-live="polite">
          {items.length === 0 ? (
            <div className={emptyBox}><p className="font-extrabold uppercase">No stores match these filters.</p><p className="mt-1 text-sm"><a href={href(ctx, "/locations")} className="underline">Show all stores</a></p></div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((s) => <li key={s.id}><StoreTile ctx={ctx} item={s} /></li>)}</ul>
          )}
        </div>
        <p className="mt-6 text-sm text-(--section-muted)">Looking for a store by distance? Use the city filter; distance sorting is not offered because addresses are only shown, not geocoded.</p>
      </div>
    );
  }
  const copy = indexCopy(ctx, kind, { title: "Services", intro: "What our stores can do for you. Availability varies by location; each service lists the stores that offer it." });
  return (
    <div>
      <div className="border-l-8 border-(--section-accent) pl-6">
        <h1 className={`text-4xl sm:text-6xl ${display}`}>{copy.title}</h1>
        {copy.intro ? <p className="mt-3 max-w-2xl text-lg font-semibold">{copy.intro}</p> : null}
      </div>
      <div className="mt-8">
        {items.length === 0 ? <p className={`${emptyBox} text-(--section-muted)`}>No services have been published yet.</p> : (
          <ol className="divide-y-2 divide-(--section-border) border-y-2 border-(--section-border)">
            {items.map((it, i) => {
              const p = itemPath(ctx, it);
              const count = Object.values(ctx.snapshot.items).filter((s) => s.kind === "store" && ((s.payload.serviceItemIds as string[]) ?? []).includes(it.id)).length;
              return (
                <li key={it.id} className="grid items-center gap-5 py-5 sm:grid-cols-[3.5rem_1fr_auto]">
                  <p className="text-3xl font-extrabold text-(--section-accent)">{String(i + 1).padStart(2, "0")}</p>
                  <div>
                    <h2 className="text-xl font-extrabold uppercase tracking-wide">{p ? <a href={href(ctx, p)} className="hover:underline">{it.title}</a> : it.title}</h2>
                    {it.payload.summary ? <p className="mt-1 max-w-prose">{String(it.payload.summary)}</p> : null}
                  </div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-(--section-muted)">{count === 0 ? "Not at a published store" : `${count} store${count === 1 ? "" : "s"}`}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

export function StorefrontSearch({ ctx }: { ctx: RenderContext }) {
  const q = (ctx.query.q ?? "").trim();
  const results = q ? searchSnapshot(ctx.snapshot, { query: q, now: ctx.now }) : [];
  return (
    <div className="max-w-3xl">
      <div className={darkStrip}>
        <h1 className={`text-4xl ${display}`} style={{ color: "var(--brand-on-text)" }}>Search</h1>
        <form method="get" action={href(ctx, "/search")} role="search" className="mt-4 flex gap-2">
          <label htmlFor="q" className="sr-only">Search stores and services</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Store, city or service" className="min-w-0 flex-1 rounded-(--radius) border-2 border-(--brand-border-strong) bg-(--brand-bg) px-3 py-2 text-(--brand-text)" />
          <button type="submit" className="rounded-(--radius) bg-(--brand-accent) px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-(--brand-on-accent)">Search</button>
          {q ? <a href={href(ctx, "/search")} className="self-center text-sm underline">Clear</a> : null}
        </form>
      </div>
      <div className="mt-6" aria-live="polite">
        {q && results.length === 0 ? <p className={emptyBox}>No results for “{q}”. Try a city name or browse <a href={href(ctx, "/locations")} className="underline">all locations</a>.</p> : null}
        {results.length ? (
          <ol className="divide-y-2 divide-(--section-border)">
            {results.map((r) => (
              <li key={r.path} className="py-3">
                <p className={storeEyebrow}>{r.kindLabel}{r.meta ? ` · ${r.meta}` : ""}</p>
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

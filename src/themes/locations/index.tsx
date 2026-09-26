import type { ReactNode } from "react";
import type { Theme, RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { ResolvedRoute } from "@/server/publishing/public-site";
import type { SnapshotItem } from "@/server/publishing/snapshot";
import type { PagePayload, PageSection } from "@/modules/page";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { InquiryForm } from "@/themes/shared/inquiry-form";
import { resolveCollection, featuredImage, itemPath } from "@/themes/shared/collections";
import { locationsSans } from "@/themes/fonts";
import { hoursStatusAt } from "@/lib/hours";
import type { HoursException, WeeklyHours } from "@/modules/common";
import { LocationsStoreDetail, LocationsServiceDetail, LocationsIndex, LocationsSearch } from "@/themes/locations/pages";
import type { Block } from "@/lib/richtext";

export const locFormStyles = {
  wrapper: "space-y-4 border-t-4 border-(--brand-primary) bg-[#f5f6f8] p-6",
  input: "w-full rounded-none border border-[#9aa3b2] bg-white px-3 py-2 text-base",
  label: "mb-1 block text-sm font-bold uppercase tracking-wide",
  button: "inline-block rounded-none bg-(--brand-accent) px-6 py-3 font-bold uppercase tracking-wide text-white hover:bg-(--brand-primary) disabled:opacity-60",
  error: "text-sm font-semibold text-[#b42318]",
  success: "text-base",
  legend: "text-sm text-[#4b5563]",
};

export function LocationsLayout({ ctx, children }: { ctx: RenderContext; children: ReactNode }) {
  const { config, site } = ctx.snapshot;
  const c = config.branding.colors;
  return (
    <div
      className={`${locationsSans.variable} locations-theme min-h-screen bg-(--brand-bg) text-(--brand-text) font-(family-name:--font-locations-sans)`}
      style={{ "--brand-primary": c.primary, "--brand-accent": c.accent, "--brand-bg": c.background, "--brand-text": c.text } as React.CSSProperties}
    >
      <a href="#content" className="skip-link">Skip to content</a>
      {ctx.mode === "demo" ? <p className="bg-(--brand-accent) px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-white">Demonstration site · fictional retailer, stores and addresses</p> : null}
      <header className="border-b-4 border-(--brand-primary)">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4">
          <a href={href(ctx, "/")} className="text-2xl font-extrabold uppercase tracking-tight text-(--brand-primary)">
            {config.branding.wordmark}
          </a>
          <nav aria-label="Primary" className="flex-1">
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-bold uppercase tracking-wide">
              {config.navigation.items.map((n) => (
                <li key={n.path}>
                  <a href={href(ctx, n.path)} aria-current={ctx.path === n.path ? "page" : undefined} className="border-b-4 border-transparent py-1 hover:border-(--brand-accent) aria-[current=page]:border-(--brand-accent)">{n.label}</a>
                </li>
              ))}
              <li><a href={href(ctx, "/search")} className="border-b-4 border-transparent py-1 hover:border-(--brand-accent)">Search</a></li>
            </ul>
          </nav>
          {config.modules.stores ? <a href={href(ctx, "/locations")} className="rounded-none bg-(--brand-accent) px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-(--brand-primary)">Find a store</a> : null}
        </div>
      </header>
      <main id="content" className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mt-16 border-t-4 border-(--brand-primary)">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
          <div>
            <p className="text-lg font-extrabold uppercase text-(--brand-primary)">{config.branding.wordmark}</p>
            {config.footer.text ? <p className="mt-2 max-w-xs">{config.footer.text}</p> : null}
          </div>
          {config.footer.showContactDetails ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#4b5563]">Company contact</p>
              {site.contact.email ? <p><a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a></p> : null}
              {site.contact.phone ? <p>{site.contact.phone}</p> : null}
              {site.contact.address ? <p className="mt-1 whitespace-pre-line">{site.contact.address}</p> : null}
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#4b5563]">Links</p>
            <ul className="space-y-1">
              {config.footer.links.map((l) => <li key={l.path}><a href={href(ctx, l.path)} className="underline">{l.label}</a></li>)}
            </ul>
            <p className="mt-4 text-xs text-[#4b5563]">© {ctx.now.getFullYear()} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LocRule({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 border-t-4 border-(--brand-primary) pt-3 text-xl font-extrabold uppercase tracking-wide">{children}</h2>;
}

export function StoreStatus({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const status = hoursStatusAt({ weeklyHours: p.weeklyHours as WeeklyHours | null, exceptions: (p.exceptions as HoursException[]) ?? [], timeZone: String(p.timeZone), status: p.status as "open" | "temporarily_closed" | "permanently_closed" }, ctx.now);
  const color = status.state === "open" ? "text-[#1e7f4f]" : status.state === "closed" ? "text-[#b42318]" : "text-[#4b5563]";
  const label = status.state === "open" ? "Open now" : status.state === "closed" ? "Closed" : "Hours unknown";
  return (
    <p className={`text-sm font-bold ${color}`}>
      {label}
      <span className="font-normal text-[#4b5563]"> · {status.detail}</span>
    </p>
  );
}

export function StoreCard({ ctx, item, featured = false }: { ctx: RenderContext; item: SnapshotItem; featured?: boolean }) {
  const p = item.payload as Record<string, unknown>;
  const a = p.address as { line1: string; locality: string; region: string; postalCode: string };
  const path = itemPath(ctx, item);
  const img = featuredImage(ctx, item);
  const services = ((p.serviceItemIds as string[]) ?? []).map((id) => ctx.snapshot.items[id]).filter(Boolean);
  return (
    <div className={`flex flex-col border border-[#d1d5db] ${featured ? "md:flex-row" : ""}`}>
      {img ? <Picture ctx={ctx} media={img} sizes={featured ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} className={`${featured ? "md:w-1/2" : ""} aspect-[3/2] w-full object-cover`} /> : null}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-lg font-extrabold uppercase tracking-wide">{path ? <a href={href(ctx, path)} className="hover:underline">{item.title}</a> : item.title}</h3>
        <p className="mt-1 text-sm">{a.line1}<br />{[a.locality, a.region, a.postalCode].filter(Boolean).join(" ")}</p>
        <div className="mt-2"><StoreStatus ctx={ctx} item={item} /></div>
        {services.length ? <p className="mt-2 text-xs uppercase tracking-wide text-[#4b5563]">{services.map((s) => s!.title).join(" · ")}</p> : null}
        {path ? <a href={href(ctx, path)} className="mt-4 inline-block self-start rounded-none border-2 border-(--brand-primary) px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-(--brand-primary) hover:bg-(--brand-primary) hover:text-white">View store</a> : null}
      </div>
    </div>
  );
}

export function LocationsSections({ ctx, page }: { ctx: RenderContext; page: PagePayload }) {
  return (
    <div className="space-y-12">
      {page.sections.map((section, i) => (
        <LocationsSection key={section.id} ctx={ctx} section={section} first={i === 0} />
      ))}
    </div>
  );
}

function LocationsSection({ ctx, section, first }: { ctx: RenderContext; section: PageSection; first: boolean }) {
  switch (section.type) {
    case "text_hero":
      return (
        <section className="border-b-4 border-(--brand-primary) pb-10">
          <h1 className="max-w-4xl text-4xl font-extrabold uppercase leading-none tracking-tight text-(--brand-primary) sm:text-6xl">{section.heading}</h1>
          {section.subheading ? <p className="mt-4 max-w-2xl text-lg">{section.subheading}</p> : null}
          {section.ctaLabel && section.ctaPath ? <a href={href(ctx, section.ctaPath)} className="mt-6 inline-block rounded-none bg-(--brand-accent) px-6 py-3 font-bold uppercase tracking-wide text-white hover:bg-(--brand-primary)">{section.ctaLabel}</a> : null}
        </section>
      );
    case "image_hero": {
      const media = section.imageAssetId ? ctx.snapshot.media[section.imageAssetId] : null;
      return (
        <section className="relative">
          {media ? <Picture ctx={ctx} media={media} sizes="100vw" className="aspect-[21/9] w-full object-cover" loading="eager" fetchPriority="high" /> : null}
          <div className={`${media ? "-mt-12 ml-0 mr-auto max-w-3xl bg-white p-6 md:ml-8" : ""}`}>
            <h1 className="text-4xl font-extrabold uppercase leading-none tracking-tight text-(--brand-primary) sm:text-5xl">{section.heading}</h1>
            {section.subheading ? <p className="mt-3 text-lg">{section.subheading}</p> : null}
            {section.ctaLabel && section.ctaPath ? <a href={href(ctx, section.ctaPath)} className="mt-5 inline-block rounded-none bg-(--brand-accent) px-6 py-3 font-bold uppercase tracking-wide text-white hover:bg-(--brand-primary)">{section.ctaLabel}</a> : null}
          </div>
        </section>
      );
    }
    case "rich_text":
      return (
        <section className="max-w-3xl">
          {section.heading ? (first ? <h1 className="mb-5 text-4xl font-extrabold uppercase tracking-tight text-(--brand-primary)">{section.heading}</h1> : <LocRule>{section.heading}</LocRule>) : null}
          {section.body.length ? <RichText ctx={ctx} blocks={section.body as Block[]} className="loc-prose" /> : <p className="text-[#4b5563]">This section has no text yet.</p>}
        </section>
      );
    case "feature_list":
      return (
        <section>
          {section.heading ? <LocRule>{section.heading}</LocRule> : null}
          {section.items.length === 0 ? <p className="text-[#4b5563]">Nothing listed yet.</p> : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {section.items.map((it) => (
                <li key={it.title} className="border border-[#d1d5db] p-4">
                  <p className="font-extrabold uppercase tracking-wide">{it.path ? <a href={href(ctx, it.path)} className="hover:underline">{it.title}</a> : it.title}</p>
                  {it.text ? <p className="mt-1 text-sm">{it.text}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    case "location_collection": {
      const items = resolveCollection(ctx, section);
      const featured = section.mode === "selected";
      return (
        <section>
          {section.heading ? <LocRule>{section.heading}</LocRule> : null}
          {items.length === 0 ? (
            <p className="border border-dashed border-[#9aa3b2] p-6 text-[#4b5563]">{featured ? "No featured store selected." : "No store locations have been published yet."}</p>
          ) : featured ? (
            <div className="space-y-4">{items.map((s) => <StoreCard key={s.id} ctx={ctx} item={s} featured />)}</div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((s) => <li key={s.id}><StoreCard ctx={ctx} item={s} /></li>)}</ul>
          )}
        </section>
      );
    }
    case "content_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <section>
          {section.heading ? <LocRule>{section.heading}</LocRule> : null}
          {items.length === 0 ? <p className="border border-dashed border-[#9aa3b2] p-6 text-[#4b5563]">Nothing has been published here yet.</p> : (
            <ul className="grid gap-px bg-[#d1d5db] sm:grid-cols-2 lg:grid-cols-4">
              {items.map((it) => {
                const p = itemPath(ctx, it);
                return (
                  <li key={it.id} className="bg-white p-5">
                    <h3 className="font-extrabold uppercase tracking-wide">{p ? <a href={href(ctx, p)} className="hover:underline">{it.title}</a> : it.title}</h3>
                    {it.payload.summary ? <p className="mt-2 text-sm">{String(it.payload.summary)}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      );
    }
    case "contact_callout": {
      const { contact } = ctx.snapshot.site;
      return (
        <section className="grid gap-4 border-t-4 border-(--brand-accent) bg-[#f5f6f8] p-6 md:grid-cols-[2fr_1fr] md:items-center">
          <div>
            <h2 className="text-2xl font-extrabold uppercase tracking-wide text-(--brand-primary)">{section.heading}</h2>
            {section.text ? <p className="mt-2">{section.text}</p> : null}
            {section.showContactDetails ? <p className="mt-2 text-sm">{contact.phone}{contact.phone && contact.email ? " · " : ""}{contact.email ? <a href={`mailto:${contact.email}`} className="underline">{contact.email}</a> : null}</p> : null}
          </div>
          <a href={href(ctx, "/contact")} className="justify-self-start rounded-none bg-(--brand-primary) px-6 py-3 font-bold uppercase tracking-wide text-white hover:bg-(--brand-accent) md:justify-self-end">Contact us</a>
        </section>
      );
    }
    case "inquiry_form": {
      const locations = section.locationSelect ? Object.values(ctx.snapshot.items).filter((i) => i.kind === "store").sort((a, b) => a.title.localeCompare(b.title)).map((i) => ({ id: i.id, label: i.title })) : [];
      return (
        <section className="max-w-2xl">
          <InquiryForm endpoint={ctx.inquiryEndpoint} heading={section.heading} intro={section.intro} sourcePath={ctx.path} locations={locations} styles={locFormStyles} />
        </section>
      );
    }
  }
}

export const locationsTheme: Theme = {
  key: "locations",
  render(ctx, route: ResolvedRoute) {
    switch (route.type) {
      case "page":
        return <LocationsLayout ctx={ctx}><LocationsSections ctx={ctx} page={route.item.payload as unknown as PagePayload} /></LocationsLayout>;
      case "detail":
        return <LocationsLayout ctx={ctx}>{route.kind === "store" ? <LocationsStoreDetail ctx={ctx} item={route.item} /> : route.kind === "service" ? <LocationsServiceDetail ctx={ctx} item={route.item} /> : <GenericDetail ctx={ctx} item={route.item} />}</LocationsLayout>;
      case "index":
        return <LocationsLayout ctx={ctx}><LocationsIndex ctx={ctx} kind={route.kind} /></LocationsLayout>;
      case "search":
        return <LocationsLayout ctx={ctx}><LocationsSearch ctx={ctx} /></LocationsLayout>;
      default:
        return null;
    }
  },
};

function GenericDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  return (
    <article className="max-w-3xl">
      <h1 className="text-4xl font-extrabold uppercase tracking-tight text-(--brand-primary)">{item.title}</h1>
      {item.payload.summary ? <p className="mt-3 text-lg">{String(item.payload.summary)}</p> : null}
      <RichText ctx={ctx} blocks={(item.payload.body as Block[]) ?? []} className="loc-prose mt-6" />
    </article>
  );
}

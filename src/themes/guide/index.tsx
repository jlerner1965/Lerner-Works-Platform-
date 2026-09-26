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
import { guideSerif, guideSans } from "@/themes/fonts";
import { formatEventDate, formatEventTimeRange, formatDateOnly } from "@/lib/events";
import { GuidePlaceDetail, GuideEventDetail, GuideArticleDetail, GuideIndex, GuideSearch } from "@/themes/guide/pages";
import type { Block } from "@/lib/richtext";

const formStyles = {
  wrapper: "guide-form space-y-4 border border-(--brand-primary)/30 bg-white/60 p-6",
  input: "w-full border border-(--brand-text)/30 bg-white px-3 py-2 text-base",
  label: "mb-1 block text-sm font-semibold",
  button: "inline-block bg-(--brand-primary) px-5 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-60",
  error: "text-sm text-[#8a2b16]",
  success: "text-base",
  legend: "text-sm text-(--brand-text)/70",
};

export function GuideLayout({ ctx, children, title }: { ctx: RenderContext; children: ReactNode; title?: string }) {
  const { config, site } = ctx.snapshot;
  const c = config.branding.colors;
  const year = ctx.now.getFullYear();
  return (
    <div
      className={`${guideSerif.variable} ${guideSans.variable} guide-theme min-h-screen bg-(--brand-bg) text-(--brand-text) font-(family-name:--font-guide-sans)`}
      style={{ "--brand-primary": c.primary, "--brand-accent": c.accent, "--brand-bg": c.background, "--brand-text": c.text } as React.CSSProperties}
    >
      <a href="#content" className="skip-link">Skip to content</a>
      {site.mode === "demo" ? (
        <p className="bg-(--brand-text) px-4 py-1.5 text-center text-xs text-white/90">Demonstration site · {site.name} is fictional; places, events and people are not real.</p>
      ) : null}
      <header className="border-b border-(--brand-text)/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a href={href(ctx, "/")} className="font-(family-name:--font-guide-serif) text-3xl font-bold tracking-tight text-(--brand-primary)">
              {config.branding.wordmark}
            </a>
            {config.branding.tagline ? <p className="mt-0.5 text-sm italic text-(--brand-text)/70">{config.branding.tagline}</p> : null}
          </div>
          <nav aria-label="Primary">
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-semibold uppercase tracking-[0.12em]">
              {config.navigation.items.map((n) => (
                <li key={n.path}>
                  <a href={href(ctx, n.path)} aria-current={ctx.path === n.path ? "page" : undefined} className="border-b-2 border-transparent pb-0.5 hover:border-(--brand-accent) aria-[current=page]:border-(--brand-accent)">
                    {n.label}
                  </a>
                </li>
              ))}
              <li>
                <a href={href(ctx, "/search")} className="border-b-2 border-transparent pb-0.5 hover:border-(--brand-accent)">Search</a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="content" className="mx-auto max-w-6xl px-4 py-8">
        {title ? <h1 className="sr-only">{title}</h1> : null}
        {children}
      </main>
      <footer className="mt-16 border-t-2 border-(--brand-primary) bg-(--brand-primary) text-white/90">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <p className="font-(family-name:--font-guide-serif) text-xl font-bold">{config.branding.wordmark}</p>
            {config.footer.text ? <p className="mt-2 max-w-xs text-sm">{config.footer.text}</p> : null}
          </div>
          {config.footer.showContactDetails ? (
            <div className="text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Contact</p>
              {site.contact.email ? <p><a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a></p> : null}
              {site.contact.phone ? <p>{site.contact.phone}</p> : null}
              {site.contact.address ? <p className="mt-1 whitespace-pre-line">{site.contact.address}</p> : null}
            </div>
          ) : null}
          <div className="text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/70">More</p>
            <ul className="space-y-1">
              {config.footer.links.map((l) => (
                <li key={l.path}><a href={href(ctx, l.path)} className="underline">{l.label}</a></li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-white/60">© {year} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CtaLink({ ctx, label, path }: { ctx: RenderContext; label: string; path: string }) {
  if (!label || !path) return null;
  return (
    <a href={href(ctx, path)} className="inline-block border-b-2 border-(--brand-accent) pb-0.5 font-semibold text-(--brand-accent) hover:border-(--brand-primary) hover:text-(--brand-primary)">
      {label} →
    </a>
  );
}

export function GuideSectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 font-(family-name:--font-guide-serif) text-2xl font-bold text-(--brand-primary) after:h-px after:flex-1 after:bg-(--brand-text)/20">
      {children}
    </h2>
  );
}

export function GuideSections({ ctx, page }: { ctx: RenderContext; page: PagePayload }) {
  return (
    <div className="space-y-14">
      {page.sections.map((section, index) => (
        <GuideSection key={section.id} ctx={ctx} section={section} first={index === 0} />
      ))}
    </div>
  );
}

function GuideSection({ ctx, section, first }: { ctx: RenderContext; section: PageSection; first: boolean }) {
  switch (section.type) {
    case "image_hero": {
      const media = section.imageAssetId ? ctx.snapshot.media[section.imageAssetId] : null;
      return (
        <section className="grid items-center gap-8 md:grid-cols-[5fr_6fr]">
          <div>
            <h1 className="font-(family-name:--font-guide-serif) text-4xl font-bold leading-tight text-(--brand-primary) sm:text-5xl">{section.heading}</h1>
            {section.subheading ? <p className="mt-4 max-w-prose text-lg leading-relaxed">{section.subheading}</p> : null}
            <div className="mt-6"><CtaLink ctx={ctx} label={section.ctaLabel} path={section.ctaPath} /></div>
          </div>
          {media ? (
            <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 55vw, 100vw" className="aspect-[4/3] w-full object-cover" loading="eager" fetchPriority="high" />
          ) : (
            <div className="aspect-[4/3] border border-dashed border-(--brand-text)/30 p-6 text-sm text-(--brand-text)/60">No hero image selected yet.</div>
          )}
        </section>
      );
    }
    case "text_hero":
      return (
        <section className="border-b border-(--brand-text)/15 pb-10 text-center">
          <h1 className="font-(family-name:--font-guide-serif) text-4xl font-bold text-(--brand-primary) sm:text-5xl">{section.heading}</h1>
          {section.subheading ? <p className="mx-auto mt-4 max-w-2xl text-lg">{section.subheading}</p> : null}
          <div className="mt-6"><CtaLink ctx={ctx} label={section.ctaLabel} path={section.ctaPath} /></div>
        </section>
      );
    case "rich_text":
      return (
        <section className="mx-auto max-w-3xl">
          {section.heading ? (first ? <h1 className="mb-6 font-(family-name:--font-guide-serif) text-4xl font-bold text-(--brand-primary)">{section.heading}</h1> : <GuideSectionHeading>{section.heading}</GuideSectionHeading>) : null}
          {section.body.length ? <RichText ctx={ctx} blocks={section.body as Block[]} className="guide-prose" /> : <p className="text-(--brand-text)/60">This section has no text yet.</p>}
        </section>
      );
    case "feature_list":
      return (
        <section>
          {section.heading ? <GuideSectionHeading>{section.heading}</GuideSectionHeading> : null}
          {section.items.length === 0 ? (
            <p className="text-(--brand-text)/60">No categories have been added yet.</p>
          ) : (
            <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
              {section.items.map((item) => (
                <li key={item.title} className="border-t border-(--brand-text)/20 py-3">
                  {item.path ? (
                    <a href={href(ctx, item.path)} className="font-(family-name:--font-guide-serif) text-lg font-semibold text-(--brand-primary) hover:underline">{item.title}</a>
                  ) : (
                    <p className="font-(family-name:--font-guide-serif) text-lg font-semibold">{item.title}</p>
                  )}
                  {item.text ? <p className="mt-1 text-sm text-(--brand-text)/80">{item.text}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    case "content_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <section>
          {section.heading ? <GuideSectionHeading>{section.heading}</GuideSectionHeading> : null}
          <GuideCollection ctx={ctx} kind={section.kind} items={items} mode={section.mode} />
        </section>
      );
    }
    case "location_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <section>
          {section.heading ? <GuideSectionHeading>{section.heading}</GuideSectionHeading> : null}
          <GuideCollection ctx={ctx} kind="store" items={items} mode="latest" />
        </section>
      );
    }
    case "contact_callout": {
      const { contact } = ctx.snapshot.site;
      return (
        <section className="border-l-4 border-(--brand-accent) bg-white/50 px-6 py-5">
          <h2 className="font-(family-name:--font-guide-serif) text-2xl font-bold text-(--brand-primary)">{section.heading}</h2>
          {section.text ? <p className="mt-2 max-w-prose">{section.text}</p> : null}
          {section.showContactDetails ? (
            <p className="mt-3 text-sm">
              {contact.email ? <a href={`mailto:${contact.email}`} className="font-semibold text-(--brand-accent) underline">{contact.email}</a> : null}
              {contact.email && contact.phone ? " · " : ""}
              {contact.phone}
            </p>
          ) : null}
          <p className="mt-3"><CtaLink ctx={ctx} label="Contact page" path="/contact" /></p>
        </section>
      );
    }
    case "inquiry_form": {
      const locations = section.locationSelect ? Object.values(ctx.snapshot.items).filter((i) => i.kind === "place" || i.kind === "store").map((i) => ({ id: i.id, label: i.title })) : [];
      return (
        <section className="mx-auto max-w-2xl">
          <InquiryForm endpoint={ctx.inquiryEndpoint} heading={section.heading} intro={section.intro} sourcePath={ctx.path} locations={locations} styles={formStyles} />
        </section>
      );
    }
  }
}

export function GuideCollection({ ctx, kind, items, mode }: { ctx: RenderContext; kind: string; items: SnapshotItem[]; mode: string }) {
  if (items.length === 0) {
    const label = kind === "event" ? (mode === "upcoming" ? "No upcoming events are scheduled right now." : "No events have been published yet.") : kind === "place" ? "No places have been published yet." : kind === "article" ? "No articles have been published yet." : "Nothing has been published here yet.";
    return <p className="text-(--brand-text)/60">{label}</p>;
  }
  if (kind === "event") {
    return (
      <ol className="divide-y divide-(--brand-text)/15 border-y border-(--brand-text)/15">
        {items.map((ev) => {
          const path = itemPath(ctx, ev);
          const tz = String(ev.payload.timeZone);
          const start = new Date(String(ev.payload.startsAt));
          const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: tz }).format(start);
          const mon = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: tz }).format(start);
          return (
            <li key={ev.id} className="flex gap-5 py-4">
              <div className="w-14 shrink-0 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-(--brand-accent)">{mon}</p>
                <p className="font-(family-name:--font-guide-serif) text-3xl font-bold leading-none">{day}</p>
              </div>
              <div className="min-w-0">
                <p className="font-(family-name:--font-guide-serif) text-xl font-semibold">
                  {path ? <a href={href(ctx, path)} className="hover:underline">{ev.title}</a> : ev.title}
                  {ev.payload.status === "cancelled" ? <span className="ml-2 align-middle text-xs font-bold uppercase tracking-wider text-[#8a2b16]">Cancelled</span> : null}
                </p>
                <p className="text-sm text-(--brand-text)/80">{formatEventTimeRange(String(ev.payload.startsAt), String(ev.payload.endsAt), tz)} · {String(ev.payload.venueText || "")}</p>
                {ev.payload.summary ? <p className="mt-1 text-sm">{String(ev.payload.summary)}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }
  if (kind === "article") {
    const [lead, ...rest] = items;
    if (!lead) return null;
    const leadImg = featuredImage(ctx, lead);
    const leadPath = itemPath(ctx, lead);
    return (
      <div className="grid gap-8 md:grid-cols-[3fr_2fr]">
        <article>
          {leadImg ? <Picture ctx={ctx} media={leadImg} sizes="(min-width: 768px) 60vw, 100vw" className="mb-4 aspect-[16/9] w-full object-cover" /> : null}
          <p className="text-xs font-semibold uppercase tracking-wider text-(--brand-accent)">Feature</p>
          <h3 className="mt-1 font-(family-name:--font-guide-serif) text-3xl font-bold leading-tight">{leadPath ? <a href={href(ctx, leadPath)} className="hover:underline">{lead.title}</a> : lead.title}</h3>
          <p className="mt-2 text-(--brand-text)/80">{String(lead.payload.summary ?? "")}</p>
          <p className="mt-2 text-sm text-(--brand-text)/60">By {String(lead.payload.authorName)} · {formatDateOnly(String(lead.payload.publishedOn))}</p>
        </article>
        {rest.length ? (
          <ul className="space-y-4 border-t border-(--brand-text)/15 pt-4 md:border-t-0 md:border-l md:pl-8 md:pt-0">
            {rest.map((a) => {
              const p = itemPath(ctx, a);
              return (
                <li key={a.id}>
                  <h3 className="font-(family-name:--font-guide-serif) text-lg font-semibold">{p ? <a href={href(ctx, p)} className="hover:underline">{a.title}</a> : a.title}</h3>
                  <p className="text-sm text-(--brand-text)/70">{formatDateOnly(String(a.payload.publishedOn))}</p>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }
  // places (and any other kind): image cards
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const img = featuredImage(ctx, it);
        const p = itemPath(ctx, it);
        return (
          <li key={it.id} className="group">
            {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="mb-3 aspect-[4/3] w-full object-cover" /> : null}
            {it.payload.category ? <p className="text-xs font-semibold uppercase tracking-wider text-(--brand-accent)">{String(it.payload.category)}</p> : null}
            <h3 className="font-(family-name:--font-guide-serif) text-xl font-semibold">{p ? <a href={href(ctx, p)} className="group-hover:underline">{it.title}</a> : it.title}</h3>
            {it.payload.summary ? <p className="mt-1 text-sm text-(--brand-text)/80">{String(it.payload.summary)}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

export const guideTheme: Theme = {
  key: "guide",
  render(ctx, route: ResolvedRoute) {
    switch (route.type) {
      case "page": {
        const page = route.item.payload as unknown as PagePayload;
        return (
          <GuideLayout ctx={ctx}>
            <GuideSections ctx={ctx} page={page} />
          </GuideLayout>
        );
      }
      case "detail":
        return (
          <GuideLayout ctx={ctx}>
            {route.kind === "place" ? <GuidePlaceDetail ctx={ctx} item={route.item} /> : route.kind === "event" ? <GuideEventDetail ctx={ctx} item={route.item} /> : route.kind === "article" ? <GuideArticleDetail ctx={ctx} item={route.item} /> : <GenericDetail ctx={ctx} item={route.item} />}
          </GuideLayout>
        );
      case "index":
        return (
          <GuideLayout ctx={ctx}>
            <GuideIndex ctx={ctx} kind={route.kind} />
          </GuideLayout>
        );
      case "search":
        return (
          <GuideLayout ctx={ctx}>
            <GuideSearch ctx={ctx} />
          </GuideLayout>
        );
      default:
        return null;
    }
  },
};

function GenericDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="font-(family-name:--font-guide-serif) text-4xl font-bold text-(--brand-primary)">{item.title}</h1>
      {item.payload.summary ? <p className="mt-3 text-lg">{String(item.payload.summary)}</p> : null}
      <RichText ctx={ctx} blocks={(item.payload.body as Block[]) ?? []} className="guide-prose mt-6" />
    </article>
  );
}

export { formatEventDate };

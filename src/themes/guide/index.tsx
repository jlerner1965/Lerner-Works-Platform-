import type { ReactNode } from "react";
import type { Theme, RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { ResolvedRoute } from "@/server/publishing/public-site";
import type { SnapshotItem, SnapshotMedia } from "@/server/publishing/snapshot";
import type { PagePayload, PageSection } from "@/modules/page";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { InquiryForm } from "@/themes/shared/inquiry-form";
import { resolveCollection, featuredImage, itemPath } from "@/themes/shared/collections";
import { SiteRoot, BrandMark, linkProps, showSearchLink, pageHeaderImage } from "@/themes/shared/site-root";
import { SectionFrame, PageContainer } from "@/themes/shared/frame";
import { siteDesign, columnsFor } from "@/themes/shared/design";
import { FaqSection, QuotesSection, CtaBannerSection, GallerySection, FactsSection, VideoSection, MapLinkSection, columnsClass, type SectionStyle } from "@/themes/shared/sections";
import { formatEventDate, formatEventTimeRange, formatDateOnly } from "@/lib/events";
import { GuidePlaceDetail, GuideEventDetail, GuideArticleDetail, GuideIndex, GuideSearch } from "@/themes/guide/pages";
import type { Block } from "@/lib/richtext";

const formStyles = {
  wrapper: "guide-form space-y-4 rounded-(--radius) border border-(--section-border) bg-(--section-panel) p-6 text-(--section-panel-fg)",
  input: "w-full rounded-(--radius) border border-(--brand-border-strong) bg-(--brand-bg) px-3 py-2 text-base text-(--brand-text)",
  label: "mb-1 block text-sm font-semibold",
  button: "inline-block rounded-(--radius) bg-(--brand-primary) px-5 py-2.5 font-semibold text-(--brand-on-primary) hover:opacity-90 disabled:opacity-60",
  error: "text-sm text-(--brand-danger)",
  success: "text-base",
  legend: "text-sm text-(--brand-muted)",
};

export const guideStyle: SectionStyle = {
  theme: "guide",
  heading: (text) => <GuideSectionHeading>{text}</GuideSectionHeading>,
  intro: "mt-2 max-w-prose text-lg",
  eyebrow: "text-xs font-semibold uppercase tracking-wider text-(--section-accent)",
  title: "font-(family-name:--font-heading) text-lg font-semibold text-(--section-fg)",
  prose: "guide-prose",
  buttonPrimary: "inline-block rounded-(--radius) bg-(--brand-primary) px-5 py-2.5 font-semibold text-(--brand-on-primary) hover:opacity-90",
  buttonInverse: "inline-block rounded-(--radius) bg-(--section-fg) px-5 py-2.5 font-semibold text-(--section-bg) hover:opacity-90",
  buttonOutline: "inline-block rounded-(--radius) border-2 border-(--section-fg) px-5 py-2 font-semibold text-(--section-fg) hover:opacity-90",
  panel: "rounded-(--radius) border border-(--section-border) bg-(--section-panel) text-(--section-panel-fg)",
  quote: "font-(family-name:--font-heading) italic leading-snug text-(--section-heading)",
  fact: "mt-1 font-(family-name:--font-heading) text-2xl font-bold text-(--section-heading)",
};

export function GuideLayout({ ctx, children, title }: { ctx: RenderContext; children: ReactNode; title?: string }) {
  const { config, site } = ctx.snapshot;
  const year = ctx.now.getFullYear();
  const centered = siteDesign(ctx).header === "centered";
  const navLink = "border-b-2 border-transparent pb-0.5 hover:border-(--brand-accent) aria-[current=page]:border-(--brand-accent)";
  return (
    <SiteRoot ctx={ctx} themeClass="guide-theme">
      <a href="#content" className="skip-link">Skip to content</a>
      {ctx.mode === "demo" ? (
        <p className="bg-(--brand-text) px-4 py-1.5 text-center text-xs text-(--brand-on-text)">Demonstration site · {site.name} is fictional; places, events and people are not real.</p>
      ) : null}
      <header className="border-b border-(--brand-border)">
        <div className={`mx-auto max-w-(--container) px-4 py-5 ${centered ? "flex flex-col items-center gap-3 text-center" : "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"}`}>
          <div>
            <a href={href(ctx, "/")} className="inline-flex items-end">
              <BrandMark ctx={ctx} imageClass="h-10 sm:h-12" textClass="font-(family-name:--font-heading) text-3xl font-bold tracking-tight text-(--brand-primary)" />
            </a>
            {config.branding.tagline ? <p className="mt-0.5 text-sm italic text-(--brand-muted)">{config.branding.tagline}</p> : null}
          </div>
          <nav aria-label="Primary">
            <ul className={`flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-semibold uppercase tracking-[0.12em] ${centered ? "justify-center" : ""}`}>
              {config.navigation.items.map((n) => (
                <li key={n.path}>
                  <a {...linkProps(ctx, n.path)} aria-current={ctx.path === n.path ? "page" : undefined} className={navLink}>
                    {n.label}
                  </a>
                </li>
              ))}
              {showSearchLink(ctx) ? (
                <li>
                  <a href={href(ctx, "/search")} aria-current={ctx.path === "/search" ? "page" : undefined} className={navLink}>Search</a>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>
      </header>
      <main id="content" className="py-8">
        {title ? <h1 className="sr-only">{title}</h1> : null}
        {children}
      </main>
      {/* The footer sits on the primary colour, where an uploaded logo (drawn for the light background) may vanish; it shows the wordmark until a dark-surface logo variant exists. */}
      <footer className="mt-16 border-t-2 border-(--brand-primary) bg-(--brand-primary) text-(--brand-on-primary)">
        {config.footer.variant === "compact" ? (
          <div className="mx-auto flex max-w-(--container) flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="font-(family-name:--font-heading) text-lg font-bold">{config.branding.wordmark}</p>
              {config.footer.text ? <p className="max-w-md">{config.footer.text}</p> : null}
              {config.footer.showContactDetails && (site.contact.email || site.contact.phone) ? (
                <p>
                  {site.contact.email ? <a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a> : null}
                  {site.contact.email && site.contact.phone ? " · " : ""}
                  {site.contact.phone}
                </p>
              ) : null}
            </div>
            <div className="text-sm sm:text-right">
              {config.footer.links.length ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 sm:justify-end">
                  {config.footer.links.map((l) => (
                    <li key={l.path}><a {...linkProps(ctx, l.path)} className="underline">{l.label}</a></li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-xs">© {year} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto grid max-w-(--container) gap-8 px-4 py-10 sm:grid-cols-3">
            <div>
              <p className="font-(family-name:--font-heading) text-xl font-bold">{config.branding.wordmark}</p>
              {config.footer.text ? <p className="mt-2 max-w-xs text-sm">{config.footer.text}</p> : null}
            </div>
            {config.footer.showContactDetails ? (
              <div className="text-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]">Contact</p>
                {site.contact.email ? <p><a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a></p> : null}
                {site.contact.phone ? <p>{site.contact.phone}</p> : null}
                {site.contact.address ? <p className="mt-1 whitespace-pre-line">{site.contact.address}</p> : null}
              </div>
            ) : null}
            <div className="text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em]">More</p>
              <ul className="space-y-1">
                {config.footer.links.map((l) => (
                  <li key={l.path}><a {...linkProps(ctx, l.path)} className="underline">{l.label}</a></li>
                ))}
              </ul>
              <p className="mt-4 text-xs">© {year} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
            </div>
          </div>
        )}
      </footer>
    </SiteRoot>
  );
}

function CtaLink({ ctx, label, path }: { ctx: RenderContext; label: string; path: string }) {
  if (!label || !path) return null;
  return (
    <a {...linkProps(ctx, path)} className="inline-block border-b-2 border-(--section-accent) pb-0.5 font-semibold text-(--section-accent) hover:border-(--section-heading) hover:text-(--section-heading)">
      {label} →
    </a>
  );
}

export function GuideSectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 font-(family-name:--font-heading) text-2xl font-bold text-(--section-heading) after:h-px after:flex-1 after:bg-(--section-border)">
      {children}
    </h2>
  );
}

function PageHeading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-(family-name:--font-heading) font-bold text-(--section-heading) ${className}`}>{children}</h1>;
}

/** Section types that read best at prose width unless the owner widens them. */
const narrowByDefault = new Set<PageSection["type"]>(["rich_text", "inquiry_form", "faq", "video", "map_link"]);

export function GuideSections({ ctx, page }: { ctx: RenderContext; page: PagePayload }) {
  return (
    <div className="space-y-(--section-gap)">
      {page.sections.map((section, index) => (
        <SectionFrame key={section.id} appearance={section.appearance} narrow={narrowByDefault.has(section.type) || (section.type === "quotes" && (section.variant === "single" || (section.variant === "default" && section.items.length <= 1)))}>
          <GuideSection ctx={ctx} section={section} first={index === 0} />
        </SectionFrame>
      ))}
    </div>
  );
}

const overlayClass = { light: "lw-hero-overlay-light", medium: "lw-hero-overlay-medium", strong: "lw-hero-overlay-strong" } as const;

function ImageHero({ ctx, section }: { ctx: RenderContext; section: Extract<PageSection, { type: "image_hero" }> }) {
  const media = section.imageAssetId ? ctx.snapshot.media[section.imageAssetId] : null;
  const variant = section.variant === "default" ? siteDesign(ctx).hero : section.variant;
  const text = (large: boolean) => (
    <>
      <PageHeading className={large ? "text-4xl leading-tight sm:text-5xl" : "text-3xl leading-tight sm:text-4xl"}>{section.heading}</PageHeading>
      {section.subheading ? <p className="mt-4 max-w-prose text-lg leading-relaxed">{section.subheading}</p> : null}
      <div className="mt-6"><CtaLink ctx={ctx} label={section.ctaLabel} path={section.ctaPath} /></div>
    </>
  );
  if (variant === "full") {
    return (
      <div className="relative overflow-hidden rounded-(--radius) bg-(--brand-text) text-(--brand-on-text)" style={{ "--section-heading": "var(--brand-on-text)", "--section-accent": "var(--brand-on-text)", "--section-fg": "var(--brand-on-text)", "--section-bg": "var(--brand-text)" } as React.CSSProperties}>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="absolute inset-0 h-full w-full object-cover" loading="eager" fetchPriority="high" /> : null}
        <div className={`relative px-6 py-16 sm:py-24 md:px-12 ${media ? overlayClass[section.overlay] : ""}`}>
          <div className="max-w-2xl">{text(true)}</div>
        </div>
      </div>
    );
  }
  if (variant === "stacked") {
    return (
      <div>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mb-8 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
        <div className="max-w-3xl">{text(true)}</div>
      </div>
    );
  }
  return (
    <div className="grid items-center gap-8 md:grid-cols-[5fr_6fr]">
      <div>{text(true)}</div>
      {media ? (
        <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 55vw, 100vw" className="aspect-[4/3] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" />
      ) : (
        <div className="aspect-[4/3] rounded-(--radius) border border-dashed border-(--brand-border-strong) p-6 text-sm text-(--section-muted)">No hero image selected yet.</div>
      )}
    </div>
  );
}

function GuideSection({ ctx, section, first }: { ctx: RenderContext; section: PageSection; first: boolean }) {
  switch (section.type) {
    case "image_hero":
      return <ImageHero ctx={ctx} section={section} />;
    case "text_hero": {
      const statement = section.variant === "statement";
      const compact = section.variant === "compact";
      return (
        <div className={`${compact ? "pb-4" : statement ? "py-6" : "border-b border-(--section-border) pb-10"} ${section.appearance.align === "start" ? "" : "text-center"}`}>
          <PageHeading className={statement ? "text-5xl leading-none sm:text-7xl" : compact ? "text-3xl" : "text-4xl sm:text-5xl"}>{section.heading}</PageHeading>
          {section.subheading ? <p className={`mt-4 max-w-2xl text-lg ${section.appearance.align === "start" ? "" : "mx-auto"}`}>{section.subheading}</p> : null}
          <div className="mt-6"><CtaLink ctx={ctx} label={section.ctaLabel} path={section.ctaPath} /></div>
        </div>
      );
    }
    case "rich_text":
      return (
        <>
          {section.heading ? (first ? <PageHeading className="mb-6 text-4xl">{section.heading}</PageHeading> : <GuideSectionHeading>{section.heading}</GuideSectionHeading>) : null}
          {section.body.length ? (
            <RichText ctx={ctx} blocks={section.body as Block[]} className={`guide-prose ${section.variant === "columns" ? "md:columns-2 md:gap-10" : ""} ${section.variant === "lead" ? "[&>p:first-child]:text-xl [&>p:first-child]:leading-relaxed" : ""}`} />
          ) : (
            <p className="text-(--section-muted)">This section has no text yet.</p>
          )}
        </>
      );
    case "feature_list": {
      const variant = section.variant === "default" ? "grid" : section.variant;
      const item = (it: (typeof section.items)[number]) => (
        <>
          {it.path ? (
            <a {...linkProps(ctx, it.path)} className="font-(family-name:--font-heading) text-lg font-semibold text-(--section-heading) hover:underline">{it.title}</a>
          ) : (
            <p className="font-(family-name:--font-heading) text-lg font-semibold">{it.title}</p>
          )}
          {it.text ? <p className="mt-1 text-sm text-(--section-muted)">{it.text}</p> : null}
        </>
      );
      return (
        <>
          {section.heading ? <GuideSectionHeading>{section.heading}</GuideSectionHeading> : null}
          {section.items.length === 0 ? (
            <p className="text-(--section-muted)">No categories have been added yet.</p>
          ) : variant === "list" ? (
            <ul className="divide-y divide-(--section-border) border-y border-(--section-border)">
              {section.items.map((it) => <li key={it.title} className="py-3">{item(it)}</li>)}
            </ul>
          ) : variant === "cards" ? (
            <ul className={`grid gap-4 ${columnsClass[columnsFor("guide", "feature_list", section.columns)]}`}>
              {section.items.map((it) => <li key={it.title} className={`${guideStyle.panel} p-4`}>{item(it)}</li>)}
            </ul>
          ) : (
            <ul className={`grid gap-x-8 ${columnsClass[columnsFor("guide", "feature_list", section.columns)]}`}>
              {section.items.map((it) => <li key={it.title} className="border-t border-(--section-border) py-3">{item(it)}</li>)}
            </ul>
          )}
        </>
      );
    }
    case "content_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <>
          {section.heading ? <GuideSectionHeading>{section.heading}</GuideSectionHeading> : null}
          <GuideCollection ctx={ctx} kind={section.kind} items={items} mode={section.mode} variant={section.variant} columns={columnsFor("guide", "content_collection", section.columns)} />
        </>
      );
    }
    case "location_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <>
          {section.heading ? <GuideSectionHeading>{section.heading}</GuideSectionHeading> : null}
          <GuideCollection ctx={ctx} kind="store" items={items} mode="latest" variant={section.variant} columns={columnsFor("guide", "location_collection", section.columns)} />
        </>
      );
    }
    case "contact_callout": {
      const { contact } = ctx.snapshot.site;
      const details = section.showContactDetails ? (
        <p className="mt-3 text-sm">
          {contact.email ? <a href={`mailto:${contact.email}`} className="font-semibold text-(--section-accent) underline">{contact.email}</a> : null}
          {contact.email && contact.phone ? " · " : ""}
          {contact.phone}
        </p>
      ) : null;
      if (section.variant === "banner") {
        return (
          <div className={`rounded-(--radius) px-6 py-8 text-center ${section.appearance.background === "default" ? "bg-(--section-panel) text-(--section-panel-fg)" : ""}`}>
            <h2 className="font-(family-name:--font-heading) text-3xl font-bold text-(--section-heading)">{section.heading}</h2>
            {section.text ? <p className="mx-auto mt-2 max-w-prose">{section.text}</p> : null}
            {details}
            <p className="mt-4"><CtaLink ctx={ctx} label="Contact page" path="/contact" /></p>
          </div>
        );
      }
      const split = section.variant === "split";
      return (
        <div className={`${split ? "grid gap-6 md:grid-cols-[3fr_2fr] md:items-center" : ""} ${section.appearance.background === "default" ? "rounded-(--radius) border-l-4 border-(--section-accent) bg-(--section-panel) px-6 py-5 text-(--section-panel-fg)" : ""}`}>
          <div>
            <h2 className="font-(family-name:--font-heading) text-2xl font-bold text-(--section-heading)">{section.heading}</h2>
            {section.text ? <p className="mt-2 max-w-prose">{section.text}</p> : null}
            {details}
          </div>
          <p className={split ? "md:justify-self-end" : "mt-3"}><CtaLink ctx={ctx} label="Contact page" path="/contact" /></p>
        </div>
      );
    }
    case "inquiry_form": {
      const locations = section.locationSelect ? Object.values(ctx.snapshot.items).filter((i) => i.kind === "place" || i.kind === "store").map((i) => ({ id: i.id, label: i.title })) : [];
      return (
        <div className={section.variant === "wide" ? "" : "mx-auto max-w-2xl"}>
          <InquiryForm endpoint={ctx.inquiryEndpoint} heading={section.heading} intro={section.intro} sourcePath={ctx.path} locations={locations} styles={formStyles} />
        </div>
      );
    }
    case "faq":
      return <FaqSection ctx={ctx} section={section} style={guideStyle} />;
    case "quotes":
      return <QuotesSection section={section} style={guideStyle} />;
    case "cta_banner":
      return <CtaBannerSection ctx={ctx} section={section} style={guideStyle} />;
    case "gallery":
      return <GallerySection ctx={ctx} section={section} style={guideStyle} />;
    case "facts":
      return <FactsSection section={section} style={guideStyle} />;
    case "video":
      return <VideoSection ctx={ctx} section={section} style={guideStyle} />;
    case "map_link":
      return <MapLinkSection ctx={ctx} section={section} style={guideStyle} />;
  }
}

type CollectionVariant = "cards" | "list" | "text" | "featured";

function resolveCollectionVariant(ctx: RenderContext, kind: string, variant: string): CollectionVariant {
  if (variant !== "default") return variant as CollectionVariant;
  if (kind === "article") return "featured";
  if (kind === "event") return "list";
  const cards = siteDesign(ctx).cards;
  return cards === "image-side" ? "list" : cards === "text" ? "text" : "cards";
}

function eventDate(ev: SnapshotItem): { day: string; mon: string; tz: string } {
  const tz = String(ev.payload.timeZone);
  const start = new Date(String(ev.payload.startsAt));
  return { tz, day: new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: tz }).format(start), mon: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: tz }).format(start) };
}

export function GuideCollection({ ctx, kind, items, mode, variant = "default", columns = 3 }: { ctx: RenderContext; kind: string; items: SnapshotItem[]; mode: string; variant?: string; columns?: 2 | 3 | 4 }) {
  if (items.length === 0) {
    const label = kind === "event" ? (mode === "upcoming" ? "No upcoming events are scheduled right now." : "No events have been published yet.") : kind === "place" ? "No places have been published yet." : kind === "article" ? "No articles have been published yet." : "Nothing has been published here yet.";
    return <p className="text-(--section-muted)">{label}</p>;
  }
  const v = resolveCollectionVariant(ctx, kind, variant);
  const eyebrow = (it: SnapshotItem): string => {
    if (kind === "event") {
      const d = eventDate(it);
      return `${d.mon} ${d.day}${it.payload.status === "cancelled" ? " · Cancelled" : ""}`;
    }
    if (kind === "article") return `By ${String(it.payload.authorName)} · ${formatDateOnly(String(it.payload.publishedOn))}`;
    return it.payload.category ? String(it.payload.category) : "";
  };
  const meta = (it: SnapshotItem): string => {
    if (kind === "event") return `${formatEventTimeRange(String(it.payload.startsAt), String(it.payload.endsAt), eventDate(it).tz)}${venueLabel(ctx, it) ? ` · ${venueLabel(ctx, it)}` : ""}`;
    return "";
  };
  const titleLink = (it: SnapshotItem, className: string) => {
    const p = itemPath(ctx, it);
    return <h3 className={className}>{p ? <a href={href(ctx, p)} className="hover:underline">{it.title}</a> : it.title}</h3>;
  };

  if (kind === "event" && v === "list") {
    return (
      <ol className="divide-y divide-(--section-border) border-y border-(--section-border)">
        {items.map((ev) => {
          const d = eventDate(ev);
          return (
            <li key={ev.id} className="flex gap-5 py-4">
              <div className="w-14 shrink-0 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-(--section-accent)">{d.mon}</p>
                <p className="font-(family-name:--font-heading) text-3xl font-bold leading-none">{d.day}</p>
              </div>
              <div className="min-w-0">
                <p className="font-(family-name:--font-heading) text-xl font-semibold">
                  {itemPath(ctx, ev) ? <a href={href(ctx, itemPath(ctx, ev)!)} className="hover:underline">{ev.title}</a> : ev.title}
                  {ev.payload.status === "cancelled" ? <span className="ml-2 align-middle text-xs font-bold uppercase tracking-wider text-(--brand-danger)">Cancelled</span> : null}
                </p>
                <p className="text-sm text-(--section-muted)">{meta(ev)}</p>
                {ev.payload.summary ? <p className="mt-1 text-sm">{String(ev.payload.summary)}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }
  if (v === "featured") {
    const [lead, ...rest] = items;
    if (!lead) return null;
    const leadImg = featuredImage(ctx, lead);
    return (
      <div className="grid gap-8 md:grid-cols-[3fr_2fr]">
        <article>
          {leadImg ? <Picture ctx={ctx} media={leadImg} sizes="(min-width: 768px) 60vw, 100vw" className="mb-4 aspect-[16/9] w-full rounded-(--radius) object-cover" /> : null}
          <p className={guideStyle.eyebrow}>{kind === "article" ? "Feature" : eyebrow(lead)}</p>
          {titleLink(lead, "mt-1 font-(family-name:--font-heading) text-3xl font-bold leading-tight")}
          <p className="mt-2 text-(--section-muted)">{String(lead.payload.summary ?? "")}</p>
          {kind === "article" ? <p className="mt-2 text-sm text-(--section-muted)">{eyebrow(lead)}</p> : meta(lead) ? <p className="mt-2 text-sm text-(--section-muted)">{meta(lead)}</p> : null}
        </article>
        {rest.length ? (
          <ul className="space-y-4 border-t border-(--section-border) pt-4 md:border-t-0 md:border-l md:pl-8 md:pt-0">
            {rest.map((a) => (
              <li key={a.id}>
                {titleLink(a, "font-(family-name:--font-heading) text-lg font-semibold")}
                <p className="text-sm text-(--section-muted)">{kind === "article" ? formatDateOnly(String(a.payload.publishedOn)) : eyebrow(a)}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (v === "list") {
    return (
      <ul className="divide-y divide-(--section-border) border-y border-(--section-border)">
        {items.map((it) => {
          const img = featuredImage(ctx, it);
          return (
            <li key={it.id} className="flex gap-5 py-4">
              {img ? <Picture ctx={ctx} media={img} sizes="160px" className="aspect-[4/3] w-32 shrink-0 rounded-(--radius) object-cover sm:w-40" /> : null}
              <div className="min-w-0">
                {eyebrow(it) ? <p className={guideStyle.eyebrow}>{eyebrow(it)}</p> : null}
                {titleLink(it, "font-(family-name:--font-heading) text-xl font-semibold")}
                {meta(it) ? <p className="text-sm text-(--section-muted)">{meta(it)}</p> : null}
                {it.payload.summary ? <p className="mt-1 text-sm">{String(it.payload.summary)}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  if (v === "text") {
    return (
      <ul className={`grid gap-x-8 gap-y-4 ${columnsClass[columns]}`}>
        {items.map((it) => (
          <li key={it.id} className="border-t border-(--section-border) pt-3">
            {eyebrow(it) ? <p className={guideStyle.eyebrow}>{eyebrow(it)}</p> : null}
            {titleLink(it, "font-(family-name:--font-heading) text-lg font-semibold")}
            {it.payload.summary ? <p className="mt-1 text-sm text-(--section-muted)">{String(it.payload.summary)}</p> : null}
          </li>
        ))}
      </ul>
    );
  }
  // cards: image on top
  return (
    <ul className={`grid gap-6 ${columnsClass[columns]}`}>
      {items.map((it) => {
        const img = featuredImage(ctx, it);
        return (
          <li key={it.id} className="group">
            {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="mb-3 aspect-[4/3] w-full rounded-(--radius) object-cover" /> : null}
            {eyebrow(it) ? <p className={guideStyle.eyebrow}>{eyebrow(it)}</p> : null}
            {titleLink(it, "font-(family-name:--font-heading) text-xl font-semibold")}
            {meta(it) ? <p className="text-sm text-(--section-muted)">{meta(it)}</p> : null}
            {it.payload.summary ? <p className="mt-1 text-sm text-(--section-muted)">{String(it.payload.summary)}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

function venueLabel(ctx: RenderContext, ev: SnapshotItem): string {
  const venueId = ev.payload.venueItemId;
  if (typeof venueId === "string" && ctx.snapshot.items[venueId]) return ctx.snapshot.items[venueId]!.title;
  return String(ev.payload.venueText ?? "");
}

function HeaderImage({ ctx, media }: { ctx: RenderContext; media: SnapshotMedia }) {
  return (
    <PageContainer>
      <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mb-10 aspect-[3/1] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" />
    </PageContainer>
  );
}

export const guideTheme: Theme = {
  key: "guide",
  render(ctx, route: ResolvedRoute) {
    switch (route.type) {
      case "page": {
        const page = route.item.payload as unknown as PagePayload;
        const header = pageHeaderImage(ctx, route.item);
        return (
          <GuideLayout ctx={ctx}>
            {header ? <HeaderImage ctx={ctx} media={header} /> : null}
            <GuideSections ctx={ctx} page={page} />
          </GuideLayout>
        );
      }
      case "detail":
        return (
          <GuideLayout ctx={ctx}>
            <PageContainer>
              {route.kind === "place" ? <GuidePlaceDetail ctx={ctx} item={route.item} /> : route.kind === "event" ? <GuideEventDetail ctx={ctx} item={route.item} /> : route.kind === "article" ? <GuideArticleDetail ctx={ctx} item={route.item} /> : <GenericDetail ctx={ctx} item={route.item} />}
            </PageContainer>
          </GuideLayout>
        );
      case "index":
        return (
          <GuideLayout ctx={ctx}>
            <PageContainer><GuideIndex ctx={ctx} kind={route.kind} /></PageContainer>
          </GuideLayout>
        );
      case "search":
        return (
          <GuideLayout ctx={ctx}>
            <PageContainer><GuideSearch ctx={ctx} /></PageContainer>
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
      <PageHeading className="text-4xl">{item.title}</PageHeading>
      {item.payload.summary ? <p className="mt-3 text-lg">{String(item.payload.summary)}</p> : null}
      <RichText ctx={ctx} blocks={(item.payload.body as Block[]) ?? []} className="guide-prose mt-6" />
    </article>
  );
}

export { formatEventDate };

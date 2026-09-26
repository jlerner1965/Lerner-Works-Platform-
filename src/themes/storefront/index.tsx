import type { ReactNode } from "react";
import type { Theme, RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { ResolvedRoute } from "@/server/publishing/public-site";
import type { SnapshotItem, SnapshotMedia } from "@/server/publishing/snapshot";
import type { PagePayload, PageSection } from "@/modules/page";
import type { HoursException, WeeklyHours } from "@/modules/common";
import { hoursStatusAt } from "@/lib/hours";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { InquiryForm } from "@/themes/shared/inquiry-form";
import { resolveCollection, featuredImage, itemPath } from "@/themes/shared/collections";
import { visibleSections } from "@/themes/shared/empty";
import { SiteRoot, BrandMark, linkProps, showSearchLink, pageHeaderImage } from "@/themes/shared/site-root";
import { SectionFrame, PageContainer } from "@/themes/shared/frame";
import { siteDesign, columnsFor, isColouredBand } from "@/themes/shared/design";
import { FaqSection, QuotesSection, CtaBannerSection, GallerySection, FactsSection, VideoSection, MapLinkSection, columnsClass, type SectionStyle } from "@/themes/shared/sections";
import { TeamSection, LogoStripSection, ImageTextSection, ImageBandSection, HeroCollage, heroExtras } from "@/themes/shared/rich-sections";
import { StorefrontStoreDetail, StorefrontServiceDetail, StorefrontIndex, StorefrontSearch } from "@/themes/storefront/pages";
import type { Block } from "@/lib/richtext";

/**
 * Storefront composition for the location business preset (design programme D2): a dark
 * header bar carrying the store finder, the header laid over a full-bleed hero, store tiles
 * with a live status badge, services as numbered rows, a status strip on store pages and a
 * footer that lists the stores. Same section contracts as the retail composition, its own
 * hierarchy; every colour is a brand or section variable.
 */
export const storeFormStyles = {
  wrapper: "store-form space-y-4 rounded-(--radius) border-t-8 border-(--brand-accent) bg-(--section-panel) p-6 text-(--section-panel-fg)",
  input: "w-full rounded-(--radius) border-2 border-(--brand-border-strong) bg-(--brand-bg) px-3 py-2 text-base text-(--brand-text)",
  label: "mb-1 block text-xs font-extrabold uppercase tracking-wide",
  button: "inline-block rounded-(--radius) bg-(--brand-accent) px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-(--brand-on-accent) hover:bg-(--brand-primary) hover:text-(--brand-on-primary) disabled:opacity-60",
  error: "text-sm font-semibold text-(--brand-danger)",
  success: "text-base",
  legend: "text-sm text-(--brand-muted)",
};

const accentButton = "inline-block rounded-(--radius) bg-(--brand-accent) px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-(--brand-on-accent) hover:bg-(--brand-primary) hover:text-(--brand-on-primary)";
export const storeOutlineButton = "inline-block rounded-(--radius) border-2 border-(--section-fg) px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-(--section-fg) hover:bg-(--section-fg) hover:text-(--section-bg)";
export const storeEyebrow = "text-xs font-extrabold uppercase tracking-[0.14em] text-(--section-accent)";

export const storefrontStyle: SectionStyle = {
  theme: "storefront",
  heading: (text) => <StoreHeading>{text}</StoreHeading>,
  display: "text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-(--section-heading) sm:text-6xl",
  subtitle: "text-2xl font-extrabold uppercase tracking-tight text-(--section-heading)",
  intro: "mt-2 max-w-2xl text-lg",
  eyebrow: storeEyebrow,
  title: "text-lg font-extrabold uppercase tracking-wide text-(--section-fg)",
  prose: "store-prose",
  buttonPrimary: accentButton,
  buttonInverse: "inline-block rounded-(--radius) bg-(--section-fg) px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-(--section-bg) hover:opacity-90",
  buttonOutline: storeOutlineButton,
  panel: "rounded-(--radius) border-2 border-(--section-border) bg-(--section-panel) text-(--section-panel-fg)",
  quote: "text-2xl font-extrabold uppercase leading-tight tracking-tight text-(--section-heading)",
  fact: "mt-1 text-5xl font-extrabold leading-none tracking-tight text-(--section-heading)",
};

/** Section heading: a heavy uppercase title with an accent bar in front of it. */
export function StoreHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-6 flex items-center gap-3 text-2xl font-extrabold uppercase tracking-tight text-(--section-heading) before:block before:h-8 before:w-2 before:bg-(--section-accent)">
      {children}
    </h2>
  );
}

function Display({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-extrabold uppercase leading-[0.95] tracking-tight text-(--section-heading) ${className}`}>{children}</h1>;
}

/** Live status of a store as a badge (checked pairings: success and danger on the page background). */
export function StatusBadge({ ctx, item, className = "" }: { ctx: RenderContext; item: SnapshotItem; className?: string }) {
  const p = item.payload as Record<string, unknown>;
  const status = hoursStatusAt({ weeklyHours: p.weeklyHours as WeeklyHours | null, exceptions: (p.exceptions as HoursException[]) ?? [], timeZone: String(p.timeZone), status: p.status as "open" | "temporarily_closed" | "permanently_closed" }, ctx.now);
  const color = status.state === "open" ? "text-(--brand-success)" : status.state === "closed" ? "text-(--brand-danger)" : "text-(--brand-muted)";
  const label = status.state === "open" ? "Open now" : status.state === "closed" ? "Closed" : "Hours unknown";
  return (
    <span className={`inline-flex items-center gap-2 rounded-(--radius) border border-(--brand-border) bg-(--brand-bg) px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide ${color} ${className}`}>
      {label}
      <span className="font-semibold normal-case tracking-normal text-(--brand-muted)">{status.detail}</span>
    </span>
  );
}

/** Store tile: picture with the status badge over it, then name, address and services. */
export function StoreTile({ ctx, item, wide = false }: { ctx: RenderContext; item: SnapshotItem; wide?: boolean }) {
  const p = item.payload as Record<string, unknown>;
  const a = p.address as { line1: string; locality: string; region: string; postalCode: string };
  const path = itemPath(ctx, item);
  const img = featuredImage(ctx, item);
  const services = ((p.serviceItemIds as string[]) ?? []).map((id) => ctx.snapshot.items[id]).filter(Boolean);
  return (
    <div className={`flex overflow-hidden rounded-(--radius) bg-(--brand-text) text-(--brand-on-text) ${wide ? "flex-col md:flex-row" : "flex-col"}`}>
      <div className={`relative ${wide ? "md:w-1/2" : ""}`}>
        {img ? <Picture ctx={ctx} media={img} sizes={wide ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} className="aspect-[3/2] w-full object-cover" /> : <div className="aspect-[3/2] w-full bg-(--brand-primary)" />}
        <StatusBadge ctx={ctx} item={item} className="absolute left-3 top-3" />
      </div>
      <div className={`flex flex-1 flex-col p-5 ${wide ? "md:justify-center md:p-8" : ""}`}>
        <p className="border-l-4 border-(--brand-accent) pl-2 text-xs font-extrabold uppercase tracking-[0.14em]">{a.locality}</p>
        <h3 className={`mt-1 font-extrabold uppercase tracking-tight ${wide ? "text-3xl" : "text-xl"}`}>{path ? <a href={href(ctx, path)} className="hover:underline">{item.title}</a> : item.title}</h3>
        <p className="mt-2 text-sm">{a.line1}, {[a.locality, a.region, a.postalCode].filter(Boolean).join(" ")}</p>
        {services.length ? <p className="mt-2 text-xs font-semibold uppercase tracking-wide">{services.map((s) => s!.title).join(" · ")}</p> : null}
        {path ? <a href={href(ctx, path)} className="mt-4 inline-block self-start rounded-(--radius) bg-(--brand-accent) px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-(--brand-on-accent) hover:bg-(--brand-on-text) hover:text-(--brand-text)">Store details</a> : null}
      </div>
    </div>
  );
}

function HeaderBar({ ctx, overlay }: { ctx: RenderContext; overlay: boolean }) {
  const { config } = ctx.snapshot;
  const centered = siteDesign(ctx).header === "centered";
  const cta = config.navigation.cta;
  const button = cta?.label && cta.path ? <a {...linkProps(ctx, cta.path)} className={accentButton}>{cta.label}</a> : config.modules.stores ? <a href={href(ctx, "/locations")} className={accentButton}>Find a store</a> : null;
  const navLink = "inline-block border-b-2 border-transparent py-1 text-sm font-extrabold uppercase tracking-wide hover:border-(--brand-accent) aria-[current=page]:border-(--brand-accent)";
  return (
    <header className={`${overlay ? "bg-(--brand-text) md:absolute md:inset-x-0 md:top-0 md:z-10 md:bg-transparent" : "bg-(--brand-text)"} text-(--brand-on-text)`}>
      <div className={`mx-auto max-w-(--container) px-4 py-4 ${centered ? "flex flex-col items-center gap-4 text-center" : "flex flex-wrap items-center gap-x-8 gap-y-3"}`}>
        <a href={href(ctx, "/")} className="inline-flex items-center">
          <BrandMark ctx={ctx} surface="dark" imageClass="h-9 sm:h-10" textClass="text-2xl font-extrabold uppercase tracking-tight" />
        </a>
        <nav aria-label="Primary" className={centered ? "" : "flex-1"}>
          <ul className={`flex flex-wrap gap-x-6 gap-y-1 ${centered ? "justify-center" : ""}`}>
            {config.navigation.items.map((n) => (
              <li key={n.path}><a {...linkProps(ctx, n.path)} aria-current={ctx.path === n.path ? "page" : undefined} className={navLink}>{n.label}</a></li>
            ))}
            {showSearchLink(ctx) ? <li><a href={href(ctx, "/search")} aria-current={ctx.path === "/search" ? "page" : undefined} className={navLink}>Search</a></li> : null}
          </ul>
        </nav>
        {button}
      </div>
    </header>
  );
}

/** Full-bleed opening hero with the header laid over it (header style "overlay"). */
function BleedHero({ ctx, section, overlay }: { ctx: RenderContext; section: Extract<PageSection, { type: "image_hero" }>; overlay: boolean }) {
  const media = section.imageAssetId ? ctx.snapshot.media[section.imageAssetId] : null;
  const overlayClass = { light: "lw-hero-overlay-light", medium: "lw-hero-overlay-medium", strong: "lw-hero-overlay-strong" } as const;
  return (
    <div className="relative bg-(--brand-text) text-(--brand-on-text)" style={{ "--section-heading": "var(--brand-on-text)", "--section-fg": "var(--brand-on-text)", "--section-bg": "var(--brand-text)", "--section-accent": "var(--brand-accent)" } as React.CSSProperties}>
      {media ? <Picture ctx={ctx} media={media} sizes="100vw" className="absolute inset-0 h-full w-full object-cover" loading="eager" fetchPriority="high" /> : null}
      <div className={`relative ${media ? overlayClass[section.overlay] : ""}`}>
        <div className={`mx-auto flex min-h-[60vh] max-w-(--container) flex-col justify-end px-4 pb-12 ${overlay ? "pt-12 md:pt-32" : "pt-12"}`}>
          <div className="max-w-3xl border-l-8 border-(--brand-accent) pl-6">
            <Display className="text-5xl sm:text-7xl">{section.heading}</Display>
            {section.subheading ? <p className="mt-4 max-w-2xl text-lg font-semibold sm:text-xl">{section.subheading}</p> : null}
            {section.ctaLabel && section.ctaPath ? <p className="mt-6"><a {...linkProps(ctx, section.ctaPath)} className={accentButton}>{section.ctaLabel}</a></p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StorefrontLayout({ ctx, hero, children }: { ctx: RenderContext; hero?: ReactNode; children: ReactNode }) {
  const { config, site } = ctx.snapshot;
  const year = ctx.now.getFullYear();
  const overlay = Boolean(hero) && siteDesign(ctx).header === "overlay";
  const routed = new Set(ctx.snapshot.routes.filter((r) => r.itemId).map((r) => r.itemId));
  const stores = Object.values(ctx.snapshot.items).filter((i) => i.kind === "store" && routed.has(i.id)).sort((a, b) => a.title.localeCompare(b.title));
  return (
    <SiteRoot ctx={ctx} themeClass="storefront-theme">
      <a href="#content" className="skip-link">Skip to content</a>
      {ctx.mode === "demo" ? (
        <p className="bg-(--brand-accent) px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-(--brand-on-accent)">Demonstration site · fictional retailer, stores and addresses</p>
      ) : null}
      {hero ? (
        <div className="relative">
          <HeaderBar ctx={ctx} overlay={overlay} />
          {hero}
        </div>
      ) : (
        <HeaderBar ctx={ctx} overlay={false} />
      )}
      <main id="content" className="py-10">{children}</main>
      <footer className="mt-16 border-t-8 border-(--brand-accent) bg-(--brand-surface)">
        {config.footer.variant === "compact" ? (
          <div className="mx-auto flex max-w-(--container) flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <BrandMark ctx={ctx} imageClass="h-8" textClass="text-lg font-extrabold uppercase text-(--brand-primary)" />
              {config.footer.text ? <p className="mt-1 max-w-md">{config.footer.text}</p> : null}
            </div>
            <div className="sm:text-right">
              <ul className="flex flex-wrap gap-x-4 gap-y-1 sm:justify-end">
                {stores.map((s) => { const p = itemPath(ctx, s); return <li key={s.id}>{p ? <a href={href(ctx, p)} className="underline">{s.title}</a> : s.title}</li>; })}
                {config.footer.links.map((l) => <li key={l.path}><a {...linkProps(ctx, l.path)} className="underline">{l.label}</a></li>)}
              </ul>
              <p className="mt-2 text-xs text-(--brand-muted)">© {year} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto grid max-w-(--container) gap-8 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <BrandMark ctx={ctx} imageClass="h-8" textClass="text-lg font-extrabold uppercase text-(--brand-primary)" />
              {config.footer.text ? <p className="mt-2 max-w-xs">{config.footer.text}</p> : null}
            </div>
            {stores.length ? (
              <div>
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-(--brand-muted)">Our stores</p>
                <ul className="space-y-1">
                  {stores.map((s) => {
                    const p = itemPath(ctx, s);
                    const a = s.payload.address as { locality: string };
                    return <li key={s.id}>{p ? <a href={href(ctx, p)} className="font-semibold underline">{s.title}</a> : <span className="font-semibold">{s.title}</span>}{a?.locality ? <span className="text-(--brand-muted)"> · {a.locality}</span> : null}</li>;
                  })}
                </ul>
              </div>
            ) : null}
            {config.footer.showContactDetails ? (
              <div>
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-(--brand-muted)">Company contact</p>
                {site.contact.email ? <p><a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a></p> : null}
                {site.contact.phone ? <p>{site.contact.phone}</p> : null}
                {site.contact.address ? <p className="mt-1 whitespace-pre-line">{site.contact.address}</p> : null}
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-(--brand-muted)">Links</p>
              <ul className="space-y-1">
                {config.footer.links.map((l) => <li key={l.path}><a {...linkProps(ctx, l.path)} className="underline">{l.label}</a></li>)}
              </ul>
              <p className="mt-4 text-xs text-(--brand-muted)">© {year} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
            </div>
          </div>
        )}
      </footer>
    </SiteRoot>
  );
}

const narrowByDefault = new Set<PageSection["type"]>(["rich_text", "inquiry_form", "faq", "video", "map_link"]);

/** Whether the page opens with a full-width image hero that becomes the bleed hero under the header. */
function openingHero(ctx: RenderContext, page: PagePayload): Extract<PageSection, { type: "image_hero" }> | null {
  const first = page.sections[0];
  if (!first || first.type !== "image_hero" || !first.imageAssetId || !ctx.snapshot.media[first.imageAssetId]) return null;
  const variant = first.variant === "default" ? siteDesign(ctx).hero : first.variant;
  return variant === "full" && first.appearance.background === "default" ? first : null;
}

export function StorefrontSections({ ctx, page, skipFirst }: { ctx: RenderContext; page: PagePayload; skipFirst: boolean }) {
  // Sections with nothing to show are left out (B2, D-021); publication lists them.
  const sections = visibleSections(ctx, skipFirst ? page.sections.slice(1) : page.sections);
  return (
    <div className="space-y-(--section-gap)">
      {sections.map((section, index) =>
        section.type === "image_band" ? (
          // The photo band spans the full width and sets its own colours, so it renders without the section frame (B3).
          <ImageBandSection key={section.id} ctx={ctx} section={section} style={storefrontStyle} />
        ) : (
          <SectionFrame key={section.id} appearance={section.appearance} narrowAlign="start" narrow={narrowByDefault.has(section.type) || (section.type === "quotes" && (section.variant === "single" || (section.variant === "default" && section.items.length <= 1)))}>
            <StorefrontSection ctx={ctx} section={section} first={index === 0 && !skipFirst} />
          </SectionFrame>
        ),
      )}
    </div>
  );
}

function ImageHero({ ctx, section }: { ctx: RenderContext; section: Extract<PageSection, { type: "image_hero" }> }) {
  const media = section.imageAssetId ? ctx.snapshot.media[section.imageAssetId] : null;
  const variant = section.variant === "default" ? siteDesign(ctx).hero : section.variant;
  const onBand = isColouredBand(section.appearance.background);
  const text = (
    <>
      <Display className="text-4xl sm:text-6xl">{section.heading}</Display>
      {section.subheading ? <p className="mt-4 max-w-2xl text-lg font-semibold">{section.subheading}</p> : null}
      {section.ctaLabel && section.ctaPath ? <p className="mt-6"><a {...linkProps(ctx, section.ctaPath)} className={onBand ? storefrontStyle.buttonInverse : accentButton}>{section.ctaLabel}</a></p> : null}
    </>
  );
  // B3 treatments: an oversized heading with the picture beneath, the words on a dark panel overlapping the picture, the picture with up to three more.
  if (variant === "statement") {
    return (
      <div>
        <div className="max-w-5xl border-l-8 border-(--section-accent) pl-6">
          <Display className="text-6xl sm:text-8xl lg:text-9xl">{section.heading}</Display>
          {section.subheading ? <p className="mt-5 max-w-2xl text-lg font-semibold">{section.subheading}</p> : null}
          {section.ctaLabel && section.ctaPath ? <p className="mt-6"><a {...linkProps(ctx, section.ctaPath)} className={onBand ? storefrontStyle.buttonInverse : accentButton}>{section.ctaLabel}</a></p> : null}
        </div>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mt-8 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
      </div>
    );
  }
  if (variant === "offset" && media) {
    return (
      <div className="md:grid md:grid-cols-12 md:items-end">
        <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 66vw, 100vw" className="aspect-[16/10] w-full rounded-(--radius) object-cover md:col-span-8 md:col-start-5 md:row-start-1" loading="eager" fetchPriority="high" />
        <div className="relative mx-4 -mt-12 rounded-(--radius) border-l-8 border-(--brand-accent) bg-(--brand-text) p-6 text-(--brand-on-text) md:col-span-6 md:col-start-1 md:row-start-1 md:mx-0 md:mb-10 md:p-8" style={{ "--section-heading": "var(--brand-on-text)", "--section-fg": "var(--brand-on-text)", "--section-bg": "var(--brand-text)", "--section-accent": "var(--brand-accent)" } as React.CSSProperties}>{text}</div>
      </div>
    );
  }
  if (variant === "collage" && media) {
    return (
      <div>
        <div className="max-w-3xl border-l-8 border-(--section-accent) pl-6">{text}</div>
        <HeroCollage ctx={ctx} main={media} extras={heroExtras(ctx, section)} className="mt-8" />
      </div>
    );
  }
  if (variant === "stacked") {
    return (
      <div>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mb-8 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
        <div className="max-w-3xl border-l-8 border-(--section-accent) pl-6">{text}</div>
      </div>
    );
  }
  if (variant === "split") {
    return (
      <div className="grid items-center gap-8 md:grid-cols-2">
        <div className="border-l-8 border-(--section-accent) pl-6">{text}</div>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
      </div>
    );
  }
  // full (not the page's opening section, or inside a coloured band): the image in a dark block with the words over its lower edge.
  const overlayClass = { light: "lw-hero-overlay-light", medium: "lw-hero-overlay-medium", strong: "lw-hero-overlay-strong" } as const;
  return (
    <div className="relative overflow-hidden rounded-(--radius) bg-(--brand-text) text-(--brand-on-text)" style={{ "--section-heading": "var(--brand-on-text)", "--section-fg": "var(--brand-on-text)", "--section-bg": "var(--brand-text)" } as React.CSSProperties}>
      {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="absolute inset-0 h-full w-full object-cover" loading="eager" fetchPriority="high" /> : null}
      <div className={`relative flex min-h-[24rem] flex-col justify-end p-6 md:p-10 ${media ? overlayClass[section.overlay] : ""}`}>
        <div className="max-w-3xl border-l-8 border-(--brand-accent) pl-6">{text}</div>
      </div>
    </div>
  );
}

function StorefrontSection({ ctx, section, first }: { ctx: RenderContext; section: PageSection; first: boolean }) {
  const onBand = isColouredBand(section.appearance.background);
  switch (section.type) {
    case "text_hero": {
      const statement = section.variant === "statement";
      const compact = section.variant === "compact";
      const centered = section.appearance.align === "center";
      return (
        <div className={`${compact ? "" : "border-l-8 border-(--section-accent) pl-6"} ${statement ? "py-6" : ""} ${centered ? "border-l-0 pl-0 text-center" : ""}`}>
          <Display className={statement ? "text-6xl sm:text-8xl" : compact ? "text-3xl sm:text-4xl" : "text-5xl sm:text-7xl"}>{section.heading}</Display>
          {section.subheading ? <p className={`mt-4 max-w-2xl text-lg font-semibold ${centered ? "mx-auto" : ""}`}>{section.subheading}</p> : null}
          {section.ctaLabel && section.ctaPath ? <p className="mt-6"><a {...linkProps(ctx, section.ctaPath)} className={onBand ? storefrontStyle.buttonInverse : accentButton}>{section.ctaLabel}</a></p> : null}
        </div>
      );
    }
    case "image_hero":
      return <ImageHero ctx={ctx} section={section} />;
    case "rich_text":
      return (
        <>
          {section.heading ? (first ? <Display className="mb-6 text-4xl sm:text-5xl">{section.heading}</Display> : <StoreHeading>{section.heading}</StoreHeading>) : null}
          {section.body.length ? (
            <RichText ctx={ctx} blocks={section.body as Block[]} className={`store-prose ${section.variant === "columns" ? "md:columns-2 md:gap-10" : ""} ${section.variant === "lead" ? "[&>p:first-child]:text-2xl [&>p:first-child]:font-bold" : ""}`} />
          ) : null}
        </>
      );
    case "feature_list": {
      const variant = section.variant === "default" ? "cards" : section.variant;
      const columns = columnsFor("storefront", "feature_list", section.columns);
      const item = (it: (typeof section.items)[number]) => (
        <>
          <p className="text-lg font-extrabold uppercase tracking-wide">{it.path ? <a {...linkProps(ctx, it.path)} className="hover:underline">{it.title}</a> : it.title}</p>
          {it.text ? <p className="mt-1 text-sm">{it.text}</p> : null}
        </>
      );
      return (
        <>
          {section.heading ? <StoreHeading>{section.heading}</StoreHeading> : null}
          {section.items.length === 0 ? null : variant === "list" ? (
            <ul className="divide-y-2 divide-(--section-border) border-y-2 border-(--section-border)">{section.items.map((it) => <li key={it.title} className="py-3">{item(it)}</li>)}</ul>
          ) : variant === "grid" ? (
            <ul className={`grid gap-x-8 gap-y-6 ${columnsClass[columns]}`}>{section.items.map((it, i) => <li key={it.title} className="border-t-8 border-(--section-accent) pt-3"><p className="text-3xl font-extrabold text-(--section-accent)">{String(i + 1).padStart(2, "0")}</p>{item(it)}</li>)}</ul>
          ) : (
            <ul className={`grid gap-4 ${columnsClass[columns]}`}>{section.items.map((it) => <li key={it.title} className="rounded-(--radius) bg-(--brand-text) p-5 text-(--brand-on-text)">{item(it)}</li>)}</ul>
          )}
        </>
      );
    }
    case "location_collection": {
      const items = resolveCollection(ctx, section);
      const variant = section.variant === "default" ? (section.mode === "selected" ? "featured" : "cards") : section.variant;
      return (
        <>
          {section.heading ? <StoreHeading>{section.heading}</StoreHeading> : null}
          {items.length === 0 ? null : variant === "featured" || variant === "list" ? (
            <div className="space-y-4">{items.map((s) => <StoreTile key={s.id} ctx={ctx} item={s} wide />)}</div>
          ) : (
            <ul className={`grid gap-4 ${columnsClass[columnsFor("storefront", "location_collection", section.columns)]}`}>{items.map((s) => <li key={s.id}><StoreTile ctx={ctx} item={s} /></li>)}</ul>
          )}
        </>
      );
    }
    case "content_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <>
          {section.heading ? <StoreHeading>{section.heading}</StoreHeading> : null}
          <StorefrontCollection ctx={ctx} items={items} variant={section.variant} columns={columnsFor("storefront", "content_collection", section.columns)} />
        </>
      );
    }
    case "category_list":
      // Categories belong to places; this composition does not declare the type (capabilities), so it never gets here.
      return null;
    case "contact_callout": {
      const { contact } = ctx.snapshot.site;
      const banner = section.variant === "banner";
      const panel = section.appearance.background === "default" ? "rounded-(--radius) bg-(--brand-primary) text-(--brand-on-primary)" : "";
      const button = section.appearance.background === "default" ? "inline-block rounded-(--radius) bg-(--brand-on-primary) px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-(--brand-primary) hover:opacity-90" : storefrontStyle.buttonInverse;
      const details = section.showContactDetails ? <p className="mt-3 text-sm font-semibold">{contact.phone}{contact.phone && contact.email ? " · " : ""}{contact.email ? <a href={`mailto:${contact.email}`} className="underline">{contact.email}</a> : null}</p> : null;
      return (
        <div className={`${panel} p-8 ${banner ? "text-center" : "grid gap-6 md:grid-cols-[2fr_1fr] md:items-center"}`}>
          <div>
            <h2 className="text-3xl font-extrabold uppercase tracking-tight">{section.heading}</h2>
            {section.text ? <p className={`mt-2 ${banner ? "mx-auto max-w-prose" : "max-w-prose"}`}>{section.text}</p> : null}
            {details}
          </div>
          <a href={href(ctx, "/contact")} className={`${button} ${banner ? "mt-5" : "justify-self-start md:justify-self-end"}`}>Contact us</a>
        </div>
      );
    }
    case "inquiry_form": {
      const locations = section.locationSelect ? Object.values(ctx.snapshot.items).filter((i) => i.kind === "store").sort((a, b) => a.title.localeCompare(b.title)).map((i) => ({ id: i.id, label: i.title })) : [];
      return (
        <div className={section.variant === "wide" ? "" : "max-w-2xl"}>
          <InquiryForm endpoint={ctx.inquiryEndpoint} heading={section.heading} intro={section.intro} sourcePath={ctx.path} locations={locations} styles={storeFormStyles} />
        </div>
      );
    }
    case "faq":
      return <FaqSection ctx={ctx} section={section} style={storefrontStyle} />;
    case "quotes":
      return <QuotesSection ctx={ctx} section={section} style={storefrontStyle} />;
    case "cta_banner":
      return <CtaBannerSection ctx={ctx} section={section} style={storefrontStyle} />;
    case "gallery":
      return <GallerySection ctx={ctx} section={section} style={storefrontStyle} />;
    case "facts":
      return <FactsSection section={section} style={storefrontStyle} />;
    case "video":
      return <VideoSection ctx={ctx} section={section} style={storefrontStyle} />;
    case "map_link":
      return <MapLinkSection ctx={ctx} section={section} style={storefrontStyle} />;
    case "team":
      return <TeamSection ctx={ctx} section={section} style={storefrontStyle} />;
    case "logo_strip":
      return <LogoStripSection ctx={ctx} section={section} style={storefrontStyle} />;
    case "image_text":
      return <ImageTextSection ctx={ctx} section={section} style={storefrontStyle} />;
    case "image_band":
      // Rendered by StorefrontSections outside the section frame.
      return null;
  }
}

/** Content collections (services on this preset): numbered rows by default, tiles with images, or plain text. */
export function StorefrontCollection({ ctx, items, variant = "default", columns = 3 }: { ctx: RenderContext; items: SnapshotItem[]; variant?: string; columns?: 2 | 3 | 4 }) {
  // An empty collection renders nothing; the section is left out of the page before this point (B2, D-021).
  if (items.length === 0) return null;
  const v = variant === "default" ? (siteDesign(ctx).cards === "text" ? "text" : siteDesign(ctx).cards === "image-top" ? "list" : "cards") : variant;
  const title = (it: SnapshotItem, className: string) => {
    const p = itemPath(ctx, it);
    return <h3 className={className}>{p ? <a href={href(ctx, p)} className="hover:underline">{it.title}</a> : it.title}</h3>;
  };
  if (v === "cards") {
    return (
      <ul className={`grid gap-4 ${columnsClass[columns]}`}>
        {items.map((it) => {
          const img = featuredImage(ctx, it);
          return (
            <li key={it.id} className={`overflow-hidden ${storefrontStyle.panel}`}>
              {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="aspect-[3/2] w-full object-cover" /> : null}
              <div className="p-5">
                {title(it, "text-lg font-extrabold uppercase tracking-wide")}
                {it.payload.summary ? <p className="mt-2 text-sm">{String(it.payload.summary)}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  if (v === "text") {
    return (
      <ul className={`grid gap-x-8 gap-y-6 ${columnsClass[columns]}`}>
        {items.map((it) => (
          <li key={it.id} className="border-t-4 border-(--section-heading) pt-3">
            {title(it, "text-lg font-extrabold uppercase tracking-wide")}
            {it.payload.summary ? <p className="mt-1 text-sm">{String(it.payload.summary)}</p> : null}
          </li>
        ))}
      </ul>
    );
  }
  // rows: numbered, with the picture as a thumbnail
  return (
    <ol className="divide-y-2 divide-(--section-border) border-y-2 border-(--section-border)">
      {items.map((it, i) => {
        const img = featuredImage(ctx, it);
        return (
          <li key={it.id} className="grid items-center gap-5 py-4 sm:grid-cols-[3.5rem_1fr_auto]">
            <p className="text-3xl font-extrabold text-(--section-accent)">{String(i + 1).padStart(2, "0")}</p>
            <div className="min-w-0">
              {title(it, "text-xl font-extrabold uppercase tracking-wide")}
              {it.payload.summary ? <p className="mt-1 max-w-prose text-sm">{String(it.payload.summary)}</p> : null}
            </div>
            {img ? <Picture ctx={ctx} media={img} sizes="160px" className="hidden aspect-[3/2] w-32 rounded-(--radius) object-cover sm:block" /> : <div className="hidden sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

function HeaderImage({ ctx, media }: { ctx: RenderContext; media: SnapshotMedia }) {
  return (
    <PageContainer>
      <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mb-8 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" />
    </PageContainer>
  );
}

function GenericDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  return (
    <article className="max-w-3xl">
      <Display className="text-4xl">{item.title}</Display>
      {p.summary ? <p className="mt-3 text-lg font-semibold">{String(p.summary)}</p> : null}
      <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="store-prose mt-6" />
    </article>
  );
}

export const storefrontTheme: Theme = {
  key: "storefront",
  render(ctx, route: ResolvedRoute) {
    switch (route.type) {
      case "page": {
        const page = route.item.payload as unknown as PagePayload;
        const opening = openingHero(ctx, page);
        const header = opening ? null : pageHeaderImage(ctx, route.item);
        return (
          <StorefrontLayout ctx={ctx} hero={opening ? <BleedHero ctx={ctx} section={opening} overlay={siteDesign(ctx).header === "overlay"} /> : undefined}>
            {header ? <HeaderImage ctx={ctx} media={header} /> : null}
            <StorefrontSections ctx={ctx} page={page} skipFirst={Boolean(opening)} />
          </StorefrontLayout>
        );
      }
      case "detail":
        return (
          <StorefrontLayout ctx={ctx}>
            <PageContainer>
              {route.kind === "store" ? <StorefrontStoreDetail ctx={ctx} item={route.item} /> : route.kind === "service" ? <StorefrontServiceDetail ctx={ctx} item={route.item} /> : <GenericDetail ctx={ctx} item={route.item} />}
            </PageContainer>
          </StorefrontLayout>
        );
      case "index":
        return (
          <StorefrontLayout ctx={ctx}>
            <PageContainer><StorefrontIndex ctx={ctx} kind={route.kind} /></PageContainer>
          </StorefrontLayout>
        );
      case "search":
        return (
          <StorefrontLayout ctx={ctx}>
            <PageContainer><StorefrontSearch ctx={ctx} /></PageContainer>
          </StorefrontLayout>
        );
      default:
        return null;
    }
  },
};

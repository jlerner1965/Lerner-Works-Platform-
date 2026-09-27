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
import { SiteRoot, BrandMark, linkProps, showSearchLink, pageHeaderImage, inquiriesEnabled } from "@/themes/shared/site-root";
import { SectionFrame, PageContainer } from "@/themes/shared/frame";
import { siteDesign, columnsFor, isColouredBand } from "@/themes/shared/design";
import { FaqSection, QuotesSection, CtaBannerSection, GallerySection, FactsSection, VideoSection, MapLinkSection, columnsClass, type SectionStyle } from "@/themes/shared/sections";
import { TeamSection, LogoStripSection, ImageTextSection, ImageBandSection, HeroCollage, heroExtras } from "@/themes/shared/rich-sections";
import { DownloadsSection, Attachments } from "@/themes/shared/documents";
import { LinkCards, LinkIndex, OutsideLinkDetail } from "@/themes/shared/links";
import { PracticeStoreDetail, PracticeServiceDetail, PracticeIndex, PracticeSearch } from "@/themes/practice/pages";
import type { Block } from "@/lib/richtext";

/**
 * Practice composition for the location business preset (site-building programme B3): a
 * calm professional practice. A slim header carrying the phone number and the contact
 * button, normal-case headings under a short accent rule, soft panels on the surface tint,
 * numbered services, location cards with the live status and an hours table on the
 * location page. Same section contracts as the retail compositions with a quieter
 * hierarchy; every colour is a brand or section variable.
 */
export const pracFormStyles = {
  wrapper: "prac-form space-y-4 rounded-(--radius) bg-(--section-panel) p-6 text-(--section-panel-fg)",
  input: "w-full rounded-(--radius) border border-(--brand-border-strong) bg-(--brand-bg) px-3 py-2 text-base text-(--brand-text)",
  label: "mb-1 block text-sm font-semibold",
  button: "inline-block rounded-(--radius) bg-(--brand-primary) px-5 py-2.5 font-semibold text-(--brand-on-primary) hover:opacity-90 disabled:opacity-60",
  error: "text-sm text-(--brand-danger)",
  success: "text-base",
  legend: "text-sm text-(--brand-muted)",
};

export const pracEyebrow = "text-xs font-semibold uppercase tracking-[0.14em] text-(--section-accent)";
export const pracPanel = "rounded-(--radius) bg-(--section-panel) text-(--section-panel-fg)";
const primaryButton = "inline-block rounded-(--radius) bg-(--brand-primary) px-5 py-2.5 font-semibold text-(--brand-on-primary) hover:opacity-90";
export const pracOutline = "inline-block rounded-(--radius) border border-(--brand-border-strong) px-4 py-2 text-sm font-semibold text-(--brand-primary) hover:border-(--brand-primary)";

export const practiceStyle: SectionStyle = {
  theme: "practice",
  heading: (text) => <PracticeHeading>{text}</PracticeHeading>,
  display: "font-(family-name:--font-heading) text-4xl font-semibold leading-tight tracking-tight text-(--section-heading) sm:text-5xl",
  subtitle: "font-(family-name:--font-heading) text-2xl font-semibold tracking-tight text-(--section-heading)",
  intro: "mt-2 max-w-prose text-lg text-(--section-muted)",
  eyebrow: pracEyebrow,
  title: "font-(family-name:--font-heading) text-lg font-semibold tracking-tight text-(--section-fg)",
  prose: "prac-prose",
  buttonPrimary: primaryButton,
  buttonInverse: "inline-block rounded-(--radius) bg-(--section-fg) px-5 py-2.5 font-semibold text-(--section-bg) hover:opacity-90",
  buttonOutline: "inline-block rounded-(--radius) border border-(--section-fg) px-5 py-2.5 font-semibold text-(--section-fg) hover:opacity-90",
  panel: pracPanel,
  quote: "font-(family-name:--font-heading) leading-snug text-(--section-heading)",
  fact: "mt-1 font-(family-name:--font-heading) text-4xl font-semibold tracking-tight text-(--section-heading)",
};

/** Section heading: a short accent rule above a normal-case heading. */
export function PracticeHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-6 font-(family-name:--font-heading) text-3xl font-semibold tracking-tight text-(--section-heading) before:mb-3 before:block before:h-1 before:w-10 before:rounded-full before:bg-(--section-accent)">{children}</h2>;
}

export const pracH1 = "font-(family-name:--font-heading) text-4xl font-semibold leading-tight tracking-tight text-(--section-heading)";

/** Live status of a location in words with a coloured lead word (checked pairings on the page background). */
export function LocationStatus({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const status = hoursStatusAt({ weeklyHours: p.weeklyHours as WeeklyHours | null, exceptions: (p.exceptions as HoursException[]) ?? [], timeZone: String(p.timeZone), status: p.status as "open" | "temporarily_closed" | "permanently_closed" }, ctx.now);
  const color = status.state === "open" ? "text-(--brand-success)" : status.state === "closed" ? "text-(--brand-danger)" : "text-(--brand-muted)";
  const label = status.state === "open" ? "Open now" : status.state === "closed" ? "Closed" : "Hours unknown";
  return (
    <p className="text-sm">
      <span className={`font-semibold ${color}`}>{label}</span>
      <span className="text-(--brand-muted)"> · {status.detail}</span>
    </p>
  );
}

/** Location card: a soft panel with the picture, name, address, live status and phone. */
export function LocationCard({ ctx, item, wide = false }: { ctx: RenderContext; item: SnapshotItem; wide?: boolean }) {
  const p = item.payload as Record<string, unknown>;
  const a = p.address as { line1: string; locality: string; region: string; postalCode: string };
  const path = itemPath(ctx, item);
  const img = featuredImage(ctx, item);
  const services = ((p.serviceItemIds as string[]) ?? []).map((id) => ctx.snapshot.items[id]).filter(Boolean);
  return (
    <div className={`flex overflow-hidden rounded-(--radius) bg-(--brand-surface) text-(--brand-text) ${wide ? "flex-col md:flex-row" : "flex-col"}`}>
      {img ? <Picture ctx={ctx} media={img} sizes={wide ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 50vw, 100vw"} className={`${wide ? "md:w-5/12" : ""} aspect-[3/2] w-full object-cover`} /> : null}
      <div className={`flex flex-1 flex-col p-5 ${wide ? "md:justify-center md:p-8" : ""}`}>
        <p className={pracEyebrow}>{a.locality}</p>
        <h3 className={`mt-1 font-(family-name:--font-heading) font-semibold tracking-tight ${wide ? "text-2xl" : "text-xl"}`}>{path ? <a href={href(ctx, path)} className="hover:underline">{item.title}</a> : item.title}</h3>
        <p className="mt-1 text-sm text-(--brand-muted)">{a.line1}, {[a.locality, a.region, a.postalCode].filter(Boolean).join(" ")}</p>
        <div className="mt-3"><LocationStatus ctx={ctx} item={item} /></div>
        {p.phone ? <p className="mt-1 text-sm"><a href={`tel:${String(p.phone).replace(/[^\d+]/g, "")}`} className="underline">{String(p.phone)}</a></p> : null}
        {services.length ? <p className="mt-3 text-xs text-(--brand-muted)">{services.map((s) => s!.title).join(" · ")}</p> : null}
        {path ? <a href={href(ctx, path)} className={`mt-4 self-start ${pracOutline}`}>Location details</a> : null}
      </div>
    </div>
  );
}

export function PracticeLayout({ ctx, children }: { ctx: RenderContext; children: ReactNode }) {
  const { config, site } = ctx.snapshot;
  const year = ctx.now.getFullYear();
  const centered = siteDesign(ctx).header === "centered";
  const cta = config.navigation.cta;
  const button = cta?.label && cta.path ? <a {...linkProps(ctx, cta.path)} className={primaryButton}>{cta.label}</a> : inquiriesEnabled(ctx) ? <a href={href(ctx, "/contact")} className={primaryButton}>Contact us</a> : null;
  const phone = site.contact.phone ? <a href={`tel:${site.contact.phone.replace(/[^\d+]/g, "")}`} className="font-semibold hover:underline">{site.contact.phone}</a> : null;
  const navLink = "inline-block border-b-2 border-transparent py-1 text-sm font-semibold hover:border-(--brand-accent) aria-[current=page]:border-(--brand-accent)";
  const nav = (
    <nav aria-label="Primary">
      <ul className={`flex flex-wrap gap-x-6 gap-y-1 ${centered ? "justify-center" : ""}`}>
        {config.navigation.items.map((n) => (
          <li key={n.path}><a {...linkProps(ctx, n.path)} aria-current={ctx.path === n.path ? "page" : undefined} className={navLink}>{n.label}</a></li>
        ))}
        {showSearchLink(ctx) ? <li><a href={href(ctx, "/search")} aria-current={ctx.path === "/search" ? "page" : undefined} className={navLink}>Search</a></li> : null}
      </ul>
    </nav>
  );
  const routed = new Set(ctx.snapshot.routes.filter((r) => r.itemId).map((r) => r.itemId));
  const stores = Object.values(ctx.snapshot.items).filter((i) => i.kind === "store" && routed.has(i.id)).sort((a, b) => a.title.localeCompare(b.title));
  return (
    <SiteRoot ctx={ctx} themeClass="practice-theme">
      <a href="#content" className="skip-link">Skip to content</a>
      {ctx.mode === "demo" ? (
        <p className="bg-(--brand-text) px-4 py-1.5 text-center text-xs text-(--brand-on-text)">Demonstration site · fictional practice, locations and addresses</p>
      ) : null}
      <header className="border-b border-(--brand-border)">
        {centered ? (
          <div className="mx-auto flex max-w-(--container) flex-col items-center gap-4 px-4 py-6 text-center">
            <a href={href(ctx, "/")} className="inline-flex"><BrandMark ctx={ctx} imageClass="h-10 sm:h-12" textClass="font-(family-name:--font-heading) text-2xl font-semibold tracking-tight text-(--brand-primary)" /></a>
            {config.branding.tagline ? <p className="-mt-2 text-sm text-(--brand-muted)">{config.branding.tagline}</p> : null}
            {nav}
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">{phone}{button}</div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-(--container) flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4">
            <a href={href(ctx, "/")} className="inline-flex items-center"><BrandMark ctx={ctx} imageClass="h-9 sm:h-10" textClass="font-(family-name:--font-heading) text-2xl font-semibold tracking-tight text-(--brand-primary)" /></a>
            <div className="flex-1">{nav}</div>
            <div className="flex flex-wrap items-center gap-4 text-sm">{phone}{button}</div>
          </div>
        )}
      </header>
      <main id="content" className="py-10">{children}</main>
      <footer className="mt-20 bg-(--brand-surface) text-sm">
        {config.footer.variant === "compact" ? (
          <div className="mx-auto flex max-w-(--container) flex-col gap-4 px-4 py-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <BrandMark ctx={ctx} imageClass="h-8" textClass="font-(family-name:--font-heading) text-lg font-semibold text-(--brand-primary)" />
              {config.footer.text ? <p className="mt-1 max-w-md">{config.footer.text}</p> : null}
              {config.footer.showContactDetails && (site.contact.phone || site.contact.email) ? <p className="mt-1">{site.contact.phone}{site.contact.phone && site.contact.email ? " · " : ""}{site.contact.email ? <a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a> : null}</p> : null}
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
          <div className="mx-auto grid max-w-(--container) gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <BrandMark ctx={ctx} imageClass="h-8" textClass="font-(family-name:--font-heading) text-lg font-semibold text-(--brand-primary)" />
              {config.footer.text ? <p className="mt-2 max-w-xs">{config.footer.text}</p> : null}
            </div>
            {stores.length ? (
              <div>
                <p className={`mb-2 ${pracEyebrow}`}>Locations</p>
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
                <p className={`mb-2 ${pracEyebrow}`}>Contact</p>
                {site.contact.phone ? <p><a href={`tel:${site.contact.phone.replace(/[^\d+]/g, "")}`} className="underline">{site.contact.phone}</a></p> : null}
                {site.contact.email ? <p><a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a></p> : null}
                {site.contact.address ? <p className="mt-1 whitespace-pre-line">{site.contact.address}</p> : null}
              </div>
            ) : null}
            <div>
              <p className={`mb-2 ${pracEyebrow}`}>More</p>
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

const narrowByDefault = new Set<PageSection["type"]>(["rich_text", "inquiry_form", "faq", "video", "map_link", "downloads"]);

export function PracticeSections({ ctx, page }: { ctx: RenderContext; page: PagePayload }) {
  // Sections with nothing to show are left out (B2, D-021); publication lists them.
  const sections = visibleSections(ctx, page.sections);
  return (
    <div className="space-y-(--section-gap)">
      {sections.map((section, index) =>
        section.type === "image_band" ? (
          <ImageBandSection key={section.id} ctx={ctx} section={section} style={practiceStyle} />
        ) : (
          <SectionFrame key={section.id} appearance={section.appearance} narrowAlign="start" narrow={narrowByDefault.has(section.type) || (section.type === "quotes" && (section.variant === "single" || (section.variant === "default" && section.items.length <= 1)))}>
            <PracticeSection ctx={ctx} section={section} first={index === 0} />
          </SectionFrame>
        ),
      )}
    </div>
  );
}

const overlayClass = { light: "lw-hero-overlay-light", medium: "lw-hero-overlay-medium", strong: "lw-hero-overlay-strong" } as const;

function Cta({ ctx, label, path, onBand, className = "" }: { ctx: RenderContext; label: string; path: string; onBand: boolean; className?: string }) {
  if (!label || !path) return null;
  return <a {...linkProps(ctx, path)} className={`${className} ${onBand ? practiceStyle.buttonInverse : primaryButton}`.trim()}>{label}</a>;
}

function ImageHero({ ctx, section }: { ctx: RenderContext; section: Extract<PageSection, { type: "image_hero" }> }) {
  const media = section.imageAssetId ? ctx.snapshot.media[section.imageAssetId] : null;
  const variant = section.variant === "default" ? siteDesign(ctx).hero : section.variant;
  const onBand = isColouredBand(section.appearance.background);
  const centered = section.appearance.align === "center";
  const text = (
    <>
      <h1 className="font-(family-name:--font-heading) text-4xl font-semibold leading-tight tracking-tight text-(--section-heading) sm:text-5xl">{section.heading}</h1>
      {section.subheading ? <p className={`mt-4 max-w-prose text-lg leading-relaxed text-(--section-muted) ${centered ? "mx-auto" : ""}`}>{section.subheading}</p> : null}
      <Cta ctx={ctx} label={section.ctaLabel} path={section.ctaPath} onBand={onBand} className="mt-6" />
    </>
  );
  if (variant === "statement") {
    return (
      <div className={centered ? "text-center" : ""}>
        <div className={`max-w-5xl ${centered ? "mx-auto" : ""}`}>
          <h1 className="font-(family-name:--font-heading) text-5xl font-semibold leading-none tracking-tight text-(--section-heading) sm:text-7xl lg:text-8xl">{section.heading}</h1>
          {section.subheading ? <p className={`mt-6 max-w-2xl text-xl leading-relaxed text-(--section-muted) ${centered ? "mx-auto" : ""}`}>{section.subheading}</p> : null}
          <Cta ctx={ctx} label={section.ctaLabel} path={section.ctaPath} onBand={onBand} className="mt-6" />
        </div>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mt-10 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
      </div>
    );
  }
  if (variant === "offset" && media) {
    return (
      <div className="md:grid md:grid-cols-12 md:items-end">
        <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 66vw, 100vw" className="aspect-[16/10] w-full rounded-(--radius) object-cover md:col-span-8 md:col-start-5 md:row-start-1" loading="eager" fetchPriority="high" />
        <div className={`relative mx-4 -mt-12 p-6 md:col-span-6 md:col-start-1 md:row-start-1 md:mx-0 md:mb-10 md:p-8 ${pracPanel}`}>{text}</div>
      </div>
    );
  }
  if (variant === "collage" && media) {
    return (
      <div>
        <div className={`max-w-3xl ${centered ? "mx-auto text-center" : ""}`}>{text}</div>
        <HeroCollage ctx={ctx} main={media} extras={heroExtras(ctx, section)} className="mt-8" />
      </div>
    );
  }
  if (variant === "full") {
    return (
      <div className="relative overflow-hidden rounded-(--radius) bg-(--brand-text) text-(--brand-on-text)" style={{ "--section-heading": "var(--brand-on-text)", "--section-muted": "var(--brand-on-text)", "--section-fg": "var(--brand-on-text)", "--section-bg": "var(--brand-text)" } as React.CSSProperties}>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="absolute inset-0 h-full w-full object-cover" loading="eager" fetchPriority="high" /> : null}
        <div className={`relative flex min-h-[24rem] flex-col justify-end p-6 md:p-12 ${media ? overlayClass[section.overlay] : ""}`}>
          <div className={`max-w-3xl ${centered ? "mx-auto text-center" : ""}`}>{text}</div>
        </div>
      </div>
    );
  }
  if (variant === "stacked") {
    return (
      <div className={centered ? "text-center" : ""}>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mb-8 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
        <div className={`max-w-3xl ${centered ? "mx-auto" : ""}`}>{text}</div>
      </div>
    );
  }
  // split (the theme default): the words beside the picture, which sits on a soft panel.
  if (!media) return <div className={`max-w-3xl ${centered ? "mx-auto text-center" : ""}`}>{text}</div>;
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
      <div>{text}</div>
      <div className={`${pracPanel} p-3 sm:p-4`}>
        <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" />
      </div>
    </div>
  );
}

function PracticeSection({ ctx, section, first }: { ctx: RenderContext; section: PageSection; first: boolean }) {
  const onBand = isColouredBand(section.appearance.background);
  switch (section.type) {
    case "text_hero": {
      const statement = section.variant === "statement";
      const compact = section.variant === "compact";
      const centered = section.appearance.align === "center";
      return (
        <div className={`${statement ? "py-6" : compact ? "pb-2" : "pb-6"} ${centered ? "text-center" : ""}`}>
          <h1 className={`max-w-4xl font-(family-name:--font-heading) font-semibold leading-tight tracking-tight text-(--section-heading) ${statement ? "text-6xl sm:text-8xl" : compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl"} ${centered ? "mx-auto" : ""}`}>{section.heading}</h1>
          {section.subheading ? <p className={`mt-4 max-w-2xl text-lg leading-relaxed text-(--section-muted) ${centered ? "mx-auto" : ""}`}>{section.subheading}</p> : null}
          <Cta ctx={ctx} label={section.ctaLabel} path={section.ctaPath} onBand={onBand} className="mt-6" />
        </div>
      );
    }
    case "image_hero":
      return <ImageHero ctx={ctx} section={section} />;
    case "rich_text":
      return (
        <>
          {section.heading ? (first ? <h1 className={`mb-6 ${pracH1}`}>{section.heading}</h1> : <PracticeHeading>{section.heading}</PracticeHeading>) : null}
          {section.body.length ? (
            <RichText ctx={ctx} blocks={section.body as Block[]} className={`prac-prose ${section.variant === "columns" ? "md:columns-2 md:gap-10" : ""} ${section.variant === "lead" ? "[&>p:first-child]:text-xl [&>p:first-child]:leading-relaxed [&>p:first-child]:text-(--section-muted)" : ""}`} />
          ) : null}
        </>
      );
    case "feature_list": {
      const variant = section.variant === "default" ? "cards" : section.variant;
      const columns = columnsFor("practice", "feature_list", section.columns);
      const item = (it: (typeof section.items)[number], i: number) => (
        <>
          <p className="font-(family-name:--font-heading) text-2xl font-semibold text-(--section-accent)">{String(i + 1).padStart(2, "0")}</p>
          <p className="mt-2 font-(family-name:--font-heading) text-lg font-semibold tracking-tight">{it.path ? <a {...linkProps(ctx, it.path)} className="hover:underline">{it.title}</a> : it.title}</p>
          {it.text ? <p className="mt-1 text-sm text-(--section-muted)">{it.text}</p> : null}
        </>
      );
      return (
        <>
          {section.heading ? <PracticeHeading>{section.heading}</PracticeHeading> : null}
          {section.items.length === 0 ? null : variant === "list" ? (
            <ol className="divide-y divide-(--section-border)">{section.items.map((it, i) => <li key={it.title} className="flex items-baseline gap-5 py-4">{item(it, i)}</li>)}</ol>
          ) : variant === "grid" ? (
            <ol className={`grid gap-x-8 gap-y-6 ${columnsClass[columns]}`}>{section.items.map((it, i) => <li key={it.title} className="border-t border-(--section-border) pt-4">{item(it, i)}</li>)}</ol>
          ) : (
            <ol className={`grid gap-4 ${columnsClass[columns]}`}>{section.items.map((it, i) => <li key={it.title} className={`${pracPanel} p-5`}>{item(it, i)}</li>)}</ol>
          )}
        </>
      );
    }
    case "location_collection": {
      const items = resolveCollection(ctx, section);
      const variant = section.variant === "default" ? (section.mode === "selected" ? "featured" : "cards") : section.variant;
      return (
        <>
          {section.heading ? <PracticeHeading>{section.heading}</PracticeHeading> : null}
          {items.length === 0 ? null : variant === "featured" || variant === "list" ? (
            <div className="space-y-4">{items.map((s) => <LocationCard key={s.id} ctx={ctx} item={s} wide />)}</div>
          ) : (
            <ul className={`grid gap-4 ${columnsClass[columnsFor("practice", "location_collection", section.columns)]}`}>{items.map((s) => <li key={s.id}><LocationCard ctx={ctx} item={s} /></li>)}</ul>
          )}
        </>
      );
    }
    case "content_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <>
          {section.heading ? <PracticeHeading>{section.heading}</PracticeHeading> : null}
          {section.kind === "link" ? <LinkCards ctx={ctx} items={items} style={practiceStyle} columns={columnsFor("practice", "content_collection", section.columns)} variant={section.variant} /> : <PracticeCollection ctx={ctx} items={items} variant={section.variant} columns={columnsFor("practice", "content_collection", section.columns)} />}
        </>
      );
    }
    case "category_list":
      // Categories belong to places; this composition does not declare the type (capabilities), so it never gets here.
      return null;
    case "contact_callout": {
      const { contact } = ctx.snapshot.site;
      const banner = section.variant === "banner";
      const panel = section.appearance.background === "default" ? `${pracPanel} p-8` : "p-2";
      const details = section.showContactDetails ? (
        <p className="mt-3 text-sm">
          {contact.phone ? <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="font-semibold underline">{contact.phone}</a> : null}
          {contact.phone && contact.email ? " · " : ""}
          {contact.email ? <a href={`mailto:${contact.email}`} className="underline">{contact.email}</a> : null}
        </p>
      ) : null;
      return (
        <div className={`${panel} ${banner ? "text-center" : "grid gap-6 md:grid-cols-[2fr_1fr] md:items-center"}`}>
          <div>
            <p className={pracEyebrow}>Get in touch</p>
            <h2 className="mt-1 font-(family-name:--font-heading) text-3xl font-semibold tracking-tight text-(--section-heading)">{section.heading}</h2>
            {section.text ? <p className={`mt-2 max-w-prose ${banner ? "mx-auto" : ""}`}>{section.text}</p> : null}
            {details}
          </div>
          <a href={href(ctx, "/contact")} className={`${onBand ? practiceStyle.buttonInverse : primaryButton} ${banner ? "mt-5 inline-block" : "justify-self-start md:justify-self-end"}`}>Contact us</a>
        </div>
      );
    }
    case "inquiry_form": {
      const locations = section.locationSelect ? Object.values(ctx.snapshot.items).filter((i) => i.kind === "store").sort((a, b) => a.title.localeCompare(b.title)).map((i) => ({ id: i.id, label: i.title })) : [];
      return (
        <div className={section.variant === "wide" ? "" : "max-w-2xl"}>
          <InquiryForm endpoint={ctx.inquiryEndpoint} heading={section.heading} intro={section.intro} sourcePath={ctx.path} locations={locations} styles={pracFormStyles} />
        </div>
      );
    }
    case "faq":
      return <FaqSection ctx={ctx} section={section} style={practiceStyle} />;
    case "quotes":
      return <QuotesSection ctx={ctx} section={section} style={practiceStyle} />;
    case "cta_banner":
      return <CtaBannerSection ctx={ctx} section={section} style={practiceStyle} />;
    case "gallery":
      return <GallerySection ctx={ctx} section={section} style={practiceStyle} />;
    case "facts":
      return <FactsSection section={section} style={practiceStyle} />;
    case "video":
      return <VideoSection ctx={ctx} section={section} style={practiceStyle} />;
    case "map_link":
      return <MapLinkSection ctx={ctx} section={section} style={practiceStyle} />;
    case "team":
      return <TeamSection ctx={ctx} section={section} style={practiceStyle} />;
    case "logo_strip":
      return <LogoStripSection ctx={ctx} section={section} style={practiceStyle} />;
    case "image_text":
      return <ImageTextSection ctx={ctx} section={section} style={practiceStyle} />;
    case "downloads":
      return <DownloadsSection ctx={ctx} section={section} style={practiceStyle} />;
    case "image_band":
      // Rendered by PracticeSections outside the section frame.
      return null;
  }
}

/** Content collections (services on this preset): numbered soft panels by default, picture panels, or rows with thumbnails. */
export function PracticeCollection({ ctx, items, variant = "default", columns = 2 }: { ctx: RenderContext; items: SnapshotItem[]; variant?: string; columns?: 2 | 3 | 4 }) {
  // An empty collection renders nothing; the section is left out of the page before this point (B2, D-021).
  if (items.length === 0) return null;
  const v = variant === "default" ? (siteDesign(ctx).cards === "image-side" ? "list" : siteDesign(ctx).cards === "image-top" ? "cards" : "text") : variant;
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
            <li key={it.id} className={`overflow-hidden ${pracPanel}`}>
              {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[3/2] w-full object-cover" /> : null}
              <div className="p-5">
                {title(it, "font-(family-name:--font-heading) text-xl font-semibold tracking-tight")}
                {it.payload.summary ? <p className="mt-2 text-sm text-(--section-muted)">{String(it.payload.summary)}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  if (v === "list") {
    return (
      <ul className="divide-y divide-(--section-border)">
        {items.map((it) => {
          const img = featuredImage(ctx, it);
          return (
            <li key={it.id} className="flex gap-5 py-5">
              {img ? <Picture ctx={ctx} media={img} sizes="160px" className="aspect-[3/2] w-32 shrink-0 rounded-(--radius) object-cover sm:w-40" /> : null}
              <div className="min-w-0">
                {title(it, "font-(family-name:--font-heading) text-xl font-semibold tracking-tight")}
                {it.payload.summary ? <p className="mt-1 text-sm text-(--section-muted)">{String(it.payload.summary)}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  // text (the theme default): numbered soft panels.
  return (
    <ol className={`grid gap-4 ${columnsClass[columns]}`}>
      {items.map((it, i) => (
        <li key={it.id} className={`${pracPanel} p-5`}>
          <p className="font-(family-name:--font-heading) text-2xl font-semibold text-(--section-accent)">{String(i + 1).padStart(2, "0")}</p>
          {title(it, "mt-2 font-(family-name:--font-heading) text-xl font-semibold tracking-tight")}
          {it.payload.summary ? <p className="mt-2 text-sm text-(--section-muted)">{String(it.payload.summary)}</p> : null}
        </li>
      ))}
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
  return (
    <article className="max-w-3xl">
      <h1 className={pracH1}>{item.title}</h1>
      {item.payload.summary ? <p className="mt-3 text-lg text-(--section-muted)">{String(item.payload.summary)}</p> : null}
      <RichText ctx={ctx} blocks={(item.payload.body as Block[]) ?? []} className="prac-prose mt-6" />
      <Attachments ctx={ctx} item={item} style={practiceStyle} />
    </article>
  );
}

export const practiceTheme: Theme = {
  key: "practice",
  render(ctx, route: ResolvedRoute) {
    switch (route.type) {
      case "page": {
        const header = pageHeaderImage(ctx, route.item);
        return (
          <PracticeLayout ctx={ctx}>
            {header ? <HeaderImage ctx={ctx} media={header} /> : null}
            <PracticeSections ctx={ctx} page={route.item.payload as unknown as PagePayload} />
          </PracticeLayout>
        );
      }
      case "detail":
        return (
          <PracticeLayout ctx={ctx}>
            <PageContainer>{route.kind === "link" ? <OutsideLinkDetail ctx={ctx} item={route.item} style={practiceStyle} /> : route.kind === "store" ? <PracticeStoreDetail ctx={ctx} item={route.item} /> : route.kind === "service" ? <PracticeServiceDetail ctx={ctx} item={route.item} /> : <GenericDetail ctx={ctx} item={route.item} />}</PageContainer>
          </PracticeLayout>
        );
      case "index":
        return (
          <PracticeLayout ctx={ctx}>
            <PageContainer>{route.kind === "link" ? <LinkIndex ctx={ctx} style={practiceStyle} /> : <PracticeIndex ctx={ctx} kind={route.kind} />}</PageContainer>
          </PracticeLayout>
        );
      case "search":
        return (
          <PracticeLayout ctx={ctx}>
            <PageContainer><PracticeSearch ctx={ctx} /></PageContainer>
          </PracticeLayout>
        );
      default:
        return null;
    }
  },
};

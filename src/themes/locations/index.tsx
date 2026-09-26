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
import { visibleSections } from "@/themes/shared/empty";
import { SiteRoot, BrandMark, linkProps, showSearchLink, pageHeaderImage } from "@/themes/shared/site-root";
import { SectionFrame, PageContainer } from "@/themes/shared/frame";
import { siteDesign, isColouredBand, columnsFor } from "@/themes/shared/design";
import { FaqSection, QuotesSection, CtaBannerSection, GallerySection, FactsSection, VideoSection, MapLinkSection, columnsClass, type SectionStyle } from "@/themes/shared/sections";
import { hoursStatusAt } from "@/lib/hours";
import type { HoursException, WeeklyHours } from "@/modules/common";
import { LocationsStoreDetail, LocationsServiceDetail, LocationsIndex, LocationsSearch } from "@/themes/locations/pages";
import type { Block } from "@/lib/richtext";

export const locFormStyles = {
  wrapper: "space-y-4 rounded-(--radius) border-t-4 border-(--brand-primary) bg-(--section-panel) p-6 text-(--section-panel-fg)",
  input: "w-full rounded-(--radius) border border-(--brand-border-strong) bg-(--brand-bg) px-3 py-2 text-base text-(--brand-text)",
  label: "mb-1 block text-sm font-bold uppercase tracking-wide",
  button: "inline-block rounded-(--radius) bg-(--brand-accent) px-6 py-3 font-bold uppercase tracking-wide text-(--brand-on-accent) hover:bg-(--brand-primary) hover:text-(--brand-on-primary) disabled:opacity-60",
  error: "text-sm font-semibold text-(--brand-danger)",
  success: "text-base",
  legend: "text-sm text-(--brand-muted)",
};

/** Accent call-to-action button; hover swaps to the primary colour with its own readable text. */
export const accentButton = "inline-block rounded-(--radius) bg-(--brand-accent) px-6 py-3 font-bold uppercase tracking-wide text-(--brand-on-accent) hover:bg-(--brand-primary) hover:text-(--brand-on-primary)";
export const primaryButton = "inline-block rounded-(--radius) bg-(--brand-primary) px-6 py-3 font-bold uppercase tracking-wide text-(--brand-on-primary) hover:bg-(--brand-accent) hover:text-(--brand-on-accent)";
export const outlineButton = "inline-block rounded-(--radius) border-2 border-(--brand-primary) px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-(--brand-primary) hover:bg-(--brand-primary) hover:text-(--brand-on-primary)";

export const locationsStyle: SectionStyle = {
  theme: "locations",
  heading: (text) => <LocRule>{text}</LocRule>,
  intro: "mt-2 max-w-2xl text-lg",
  eyebrow: "text-xs font-bold uppercase tracking-wide text-(--section-accent)",
  title: "font-extrabold uppercase tracking-wide text-(--section-fg)",
  prose: "loc-prose",
  buttonPrimary: accentButton,
  buttonInverse: "inline-block rounded-(--radius) bg-(--section-fg) px-6 py-3 font-bold uppercase tracking-wide text-(--section-bg) hover:opacity-90",
  buttonOutline: "inline-block rounded-(--radius) border-2 border-(--section-fg) px-6 py-3 font-bold uppercase tracking-wide text-(--section-fg) hover:opacity-90",
  panel: "rounded-(--radius) border border-(--section-border) bg-(--section-panel) text-(--section-panel-fg)",
  quote: "font-extrabold leading-snug text-(--section-heading)",
  fact: "mt-1 text-3xl font-extrabold text-(--section-heading)",
};

export function LocationsLayout({ ctx, children }: { ctx: RenderContext; children: ReactNode }) {
  const { config, site } = ctx.snapshot;
  const centered = siteDesign(ctx).header === "centered";
  const navLink = "border-b-4 border-transparent py-1 hover:border-(--brand-accent) aria-[current=page]:border-(--brand-accent)";
  // Header button: the owner's label and path when set (D2), else the composition's "Find a store" while the stores module is on.
  const cta = config.navigation.cta;
  const buttonClass = "rounded-(--radius) bg-(--brand-accent) px-4 py-2 text-sm font-bold uppercase tracking-wide text-(--brand-on-accent) hover:bg-(--brand-primary) hover:text-(--brand-on-primary)";
  const findStore = cta?.label && cta.path ? <a {...linkProps(ctx, cta.path)} className={buttonClass}>{cta.label}</a> : config.modules.stores ? <a href={href(ctx, "/locations")} className={buttonClass}>Find a store</a> : null;
  return (
    <SiteRoot ctx={ctx} themeClass="locations-theme">
      <a href="#content" className="skip-link">Skip to content</a>
      {ctx.mode === "demo" ? <p className="bg-(--brand-accent) px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-(--brand-on-accent)">Demonstration site · fictional retailer, stores and addresses</p> : null}
      <header className="border-b-4 border-(--brand-primary)">
        <div className={`mx-auto max-w-(--container) px-4 py-4 ${centered ? "flex flex-col items-center gap-3 text-center" : "flex flex-wrap items-center gap-x-8 gap-y-3"}`}>
          <a href={href(ctx, "/")} className="inline-flex items-center">
            <BrandMark ctx={ctx} imageClass="h-10 sm:h-12" textClass="text-2xl font-extrabold uppercase tracking-tight text-(--brand-primary)" />
          </a>
          <nav aria-label="Primary" className={centered ? "" : "flex-1"}>
            <ul className={`flex flex-wrap gap-x-6 gap-y-1 text-sm font-bold uppercase tracking-wide ${centered ? "justify-center" : ""}`}>
              {config.navigation.items.map((n) => (
                <li key={n.path}>
                  <a {...linkProps(ctx, n.path)} aria-current={ctx.path === n.path ? "page" : undefined} className={navLink}>{n.label}</a>
                </li>
              ))}
              {showSearchLink(ctx) ? <li><a href={href(ctx, "/search")} aria-current={ctx.path === "/search" ? "page" : undefined} className={navLink}>Search</a></li> : null}
            </ul>
          </nav>
          {findStore}
        </div>
      </header>
      <main id="content" className="py-8">{children}</main>
      <footer className="mt-16 border-t-4 border-(--brand-primary)">
        {config.footer.variant === "compact" ? (
          <div className="mx-auto flex max-w-(--container) flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <BrandMark ctx={ctx} imageClass="h-8" textClass="text-lg font-extrabold uppercase text-(--brand-primary)" />
              {config.footer.text ? <p className="max-w-md">{config.footer.text}</p> : null}
              {config.footer.showContactDetails && (site.contact.email || site.contact.phone) ? (
                <p>
                  {site.contact.phone}
                  {site.contact.phone && site.contact.email ? " · " : ""}
                  {site.contact.email ? <a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a> : null}
                </p>
              ) : null}
            </div>
            <div className="sm:text-right">
              {config.footer.links.length ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 font-bold uppercase tracking-wide sm:justify-end">
                  {config.footer.links.map((l) => <li key={l.path}><a {...linkProps(ctx, l.path)} className="underline">{l.label}</a></li>)}
                </ul>
              ) : null}
              <p className="mt-2 text-xs text-(--brand-muted)">© {ctx.now.getFullYear()} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto grid max-w-(--container) gap-8 px-4 py-10 text-sm sm:grid-cols-3">
            <div>
              <BrandMark ctx={ctx} imageClass="h-8" textClass="text-lg font-extrabold uppercase text-(--brand-primary)" />
              {config.footer.text ? <p className="mt-2 max-w-xs">{config.footer.text}</p> : null}
            </div>
            {config.footer.showContactDetails ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-(--brand-muted)">Company contact</p>
                {site.contact.email ? <p><a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a></p> : null}
                {site.contact.phone ? <p>{site.contact.phone}</p> : null}
                {site.contact.address ? <p className="mt-1 whitespace-pre-line">{site.contact.address}</p> : null}
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-(--brand-muted)">Links</p>
              <ul className="space-y-1">
                {config.footer.links.map((l) => <li key={l.path}><a {...linkProps(ctx, l.path)} className="underline">{l.label}</a></li>)}
              </ul>
              <p className="mt-4 text-xs text-(--brand-muted)">© {ctx.now.getFullYear()} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
            </div>
          </div>
        )}
      </footer>
    </SiteRoot>
  );
}

export function LocRule({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 border-t-4 border-(--section-heading) pt-3 text-xl font-extrabold uppercase tracking-wide">{children}</h2>;
}

const h1 = "text-4xl font-extrabold uppercase tracking-tight text-(--section-heading)";

export function StoreStatus({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  const status = hoursStatusAt({ weeklyHours: p.weeklyHours as WeeklyHours | null, exceptions: (p.exceptions as HoursException[]) ?? [], timeZone: String(p.timeZone), status: p.status as "open" | "temporarily_closed" | "permanently_closed" }, ctx.now);
  const color = status.state === "open" ? "text-(--brand-success)" : status.state === "closed" ? "text-(--brand-danger)" : "text-(--brand-muted)";
  const label = status.state === "open" ? "Open now" : status.state === "closed" ? "Closed" : "Hours unknown";
  return (
    <p className={`text-sm font-bold ${color}`}>
      {label}
      <span className="font-normal text-(--brand-muted)"> · {status.detail}</span>
    </p>
  );
}

/** Store card on the page colours (it sits on a panel of its own, so status colours stay checked). */
export function StoreCard({ ctx, item, featured = false }: { ctx: RenderContext; item: SnapshotItem; featured?: boolean }) {
  const p = item.payload as Record<string, unknown>;
  const a = p.address as { line1: string; locality: string; region: string; postalCode: string };
  const path = itemPath(ctx, item);
  const img = featuredImage(ctx, item);
  const services = ((p.serviceItemIds as string[]) ?? []).map((id) => ctx.snapshot.items[id]).filter(Boolean);
  return (
    <div className={`flex flex-col overflow-hidden rounded-(--radius) border border-(--brand-border) bg-(--brand-bg) text-(--brand-text) ${featured ? "md:flex-row" : ""}`}>
      {img ? <Picture ctx={ctx} media={img} sizes={featured ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} className={`${featured ? "md:w-1/2" : ""} aspect-[3/2] w-full object-cover`} /> : null}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-lg font-extrabold uppercase tracking-wide">{path ? <a href={href(ctx, path)} className="hover:underline">{item.title}</a> : item.title}</h3>
        <p className="mt-1 text-sm">{a.line1}<br />{[a.locality, a.region, a.postalCode].filter(Boolean).join(" ")}</p>
        <div className="mt-2"><StoreStatus ctx={ctx} item={item} /></div>
        {services.length ? <p className="mt-2 text-xs uppercase tracking-wide text-(--brand-muted)">{services.map((s) => s!.title).join(" · ")}</p> : null}
        {path ? <a href={href(ctx, path)} className={`mt-4 self-start ${outlineButton}`}>View store</a> : null}
      </div>
    </div>
  );
}

const narrowByDefault = new Set<PageSection["type"]>(["rich_text", "inquiry_form", "faq", "video", "map_link"]);

export function LocationsSections({ ctx, page }: { ctx: RenderContext; page: PagePayload }) {
  // Sections with nothing to show are left out (B2, D-021); publication lists them.
  const sections = visibleSections(ctx, page.sections);
  return (
    <div className="space-y-(--section-gap)">
      {sections.map((section, i) => (
        <SectionFrame key={section.id} appearance={section.appearance} narrowAlign="start" narrow={narrowByDefault.has(section.type) || (section.type === "quotes" && (section.variant === "single" || (section.variant === "default" && section.items.length <= 1)))}>
          <LocationsSection ctx={ctx} section={section} first={i === 0} />
        </SectionFrame>
      ))}
    </div>
  );
}

function Cta({ ctx, label, path, onBand, className = "" }: { ctx: RenderContext; label: string; path: string; onBand: boolean; className?: string }) {
  if (!label || !path) return null;
  return <a {...linkProps(ctx, path)} className={`${className} ${onBand ? locationsStyle.buttonInverse : accentButton}`.trim()}>{label}</a>;
}

function ImageHero({ ctx, section }: { ctx: RenderContext; section: Extract<PageSection, { type: "image_hero" }> }) {
  const media = section.imageAssetId ? ctx.snapshot.media[section.imageAssetId] : null;
  const variant = section.variant === "default" ? siteDesign(ctx).hero : section.variant;
  const onBand = isColouredBand(section.appearance.background);
  const text = (
    <>
      <h1 className="text-4xl font-extrabold uppercase leading-none tracking-tight text-(--section-heading) sm:text-5xl">{section.heading}</h1>
      {section.subheading ? <p className="mt-3 text-lg">{section.subheading}</p> : null}
      <Cta ctx={ctx} label={section.ctaLabel} path={section.ctaPath} onBand={onBand} className="mt-5" />
    </>
  );
  if (variant === "stacked") {
    return (
      <div>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mb-6 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
        <div className="max-w-3xl">{text}</div>
      </div>
    );
  }
  if (variant === "split") {
    return (
      <div className="grid items-center gap-8 md:grid-cols-2">
        <div>{text}</div>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
      </div>
    );
  }
  // full: the image across the width with a text panel in the band's own colour cutting into its lower edge.
  return (
    <div className="relative">
      {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
      {/* Positioned, so its background paints above the image it overlaps (block backgrounds paint before replaced content). */}
      <div className={media ? "relative -mt-12 ml-0 mr-auto max-w-3xl rounded-(--radius) bg-(--section-bg) p-6 text-(--section-fg) md:ml-8" : ""}>{text}</div>
    </div>
  );
}

function LocationsSection({ ctx, section, first }: { ctx: RenderContext; section: PageSection; first: boolean }) {
  const onBand = isColouredBand(section.appearance.background);
  switch (section.type) {
    case "text_hero": {
      const statement = section.variant === "statement";
      const compact = section.variant === "compact";
      return (
        <div className={compact ? "pb-4" : statement ? "py-6" : "border-b-4 border-(--section-heading) pb-10"}>
          <h1 className={`max-w-4xl font-extrabold uppercase leading-none tracking-tight text-(--section-heading) ${statement ? "text-6xl sm:text-8xl" : compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl"} ${section.appearance.align === "center" ? "mx-auto" : ""}`}>{section.heading}</h1>
          {section.subheading ? <p className={`mt-4 max-w-2xl text-lg ${section.appearance.align === "center" ? "mx-auto" : ""}`}>{section.subheading}</p> : null}
          <Cta ctx={ctx} label={section.ctaLabel} path={section.ctaPath} onBand={onBand} className="mt-6" />
        </div>
      );
    }
    case "image_hero":
      return <ImageHero ctx={ctx} section={section} />;
    case "rich_text":
      return (
        <>
          {section.heading ? (first ? <h1 className={`mb-5 ${h1}`}>{section.heading}</h1> : <LocRule>{section.heading}</LocRule>) : null}
          {section.body.length ? (
            <RichText ctx={ctx} blocks={section.body as Block[]} className={`loc-prose ${section.variant === "columns" ? "md:columns-2 md:gap-10" : ""} ${section.variant === "lead" ? "[&>p:first-child]:text-xl [&>p:first-child]:font-semibold" : ""}`} />
          ) : null}
        </>
      );
    case "feature_list": {
      const variant = section.variant === "default" ? "cards" : section.variant;
      const item = (it: (typeof section.items)[number]) => (
        <>
          <p className="font-extrabold uppercase tracking-wide">{it.path ? <a {...linkProps(ctx, it.path)} className="hover:underline">{it.title}</a> : it.title}</p>
          {it.text ? <p className="mt-1 text-sm">{it.text}</p> : null}
        </>
      );
      return (
        <>
          {section.heading ? <LocRule>{section.heading}</LocRule> : null}
          {section.items.length === 0 ? null : variant === "list" ? (
            <ul className="divide-y divide-(--section-border) border-y border-(--section-border)">{section.items.map((it) => <li key={it.title} className="py-3">{item(it)}</li>)}</ul>
          ) : variant === "grid" ? (
            <ul className={`grid gap-x-8 ${columnsClass[columnsFor("locations", "feature_list", section.columns)]}`}>{section.items.map((it) => <li key={it.title} className="border-t-4 border-(--section-heading) py-3">{item(it)}</li>)}</ul>
          ) : (
            <ul className={`grid gap-4 ${columnsClass[columnsFor("locations", "feature_list", section.columns)]}`}>{section.items.map((it) => <li key={it.title} className="rounded-(--radius) border border-(--section-border) p-4">{item(it)}</li>)}</ul>
          )}
        </>
      );
    }
    case "location_collection": {
      const items = resolveCollection(ctx, section);
      const variant = section.variant === "default" ? (section.mode === "selected" ? "featured" : "cards") : section.variant;
      return (
        <>
          {section.heading ? <LocRule>{section.heading}</LocRule> : null}
          {items.length === 0 ? null : variant === "featured" || variant === "list" ? (
            <div className="space-y-4">{items.map((s) => <StoreCard key={s.id} ctx={ctx} item={s} featured />)}</div>
          ) : (
            <ul className={`grid gap-4 ${columnsClass[columnsFor("locations", "location_collection", section.columns)]}`}>{items.map((s) => <li key={s.id}><StoreCard ctx={ctx} item={s} /></li>)}</ul>
          )}
        </>
      );
    }
    case "content_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <>
          {section.heading ? <LocRule>{section.heading}</LocRule> : null}
          <LocationsCollection ctx={ctx} items={items} variant={section.variant} columns={columnsFor("locations", "content_collection", section.columns)} />
        </>
      );
    }
    case "category_list":
      // Categories belong to places; this composition does not declare the type (capabilities), so it never gets here.
      return null;
    case "contact_callout": {
      const { contact } = ctx.snapshot.site;
      const banner = section.variant === "banner";
      const panel = section.appearance.background === "default" ? "rounded-(--radius) border-t-4 border-(--section-accent) bg-(--section-panel) p-6 text-(--section-panel-fg)" : "";
      const details = section.showContactDetails ? <p className="mt-2 text-sm">{contact.phone}{contact.phone && contact.email ? " · " : ""}{contact.email ? <a href={`mailto:${contact.email}`} className="underline">{contact.email}</a> : null}</p> : null;
      return (
        <div className={`${panel} ${banner ? "text-center" : "grid gap-4 md:grid-cols-[2fr_1fr] md:items-center"}`}>
          <div>
            <h2 className="text-2xl font-extrabold uppercase tracking-wide text-(--section-heading)">{section.heading}</h2>
            {section.text ? <p className={`mt-2 ${banner ? "mx-auto max-w-prose" : ""}`}>{section.text}</p> : null}
            {details}
          </div>
          <a href={href(ctx, "/contact")} className={`${banner ? "mt-5 inline-block" : "justify-self-start md:justify-self-end"} ${onBand ? locationsStyle.buttonInverse : primaryButton}`}>Contact us</a>
        </div>
      );
    }
    case "inquiry_form": {
      const locations = section.locationSelect ? Object.values(ctx.snapshot.items).filter((i) => i.kind === "store").sort((a, b) => a.title.localeCompare(b.title)).map((i) => ({ id: i.id, label: i.title })) : [];
      return (
        <div className={section.variant === "wide" ? "" : "max-w-2xl"}>
          <InquiryForm endpoint={ctx.inquiryEndpoint} heading={section.heading} intro={section.intro} sourcePath={ctx.path} locations={locations} styles={locFormStyles} />
        </div>
      );
    }
    case "faq":
      return <FaqSection ctx={ctx} section={section} style={locationsStyle} />;
    case "quotes":
      return <QuotesSection section={section} style={locationsStyle} />;
    case "cta_banner":
      return <CtaBannerSection ctx={ctx} section={section} style={locationsStyle} />;
    case "gallery":
      return <GallerySection ctx={ctx} section={section} style={locationsStyle} />;
    case "facts":
      return <FactsSection section={section} style={locationsStyle} />;
    case "video":
      return <VideoSection ctx={ctx} section={section} style={locationsStyle} />;
    case "map_link":
      return <MapLinkSection ctx={ctx} section={section} style={locationsStyle} />;
  }
}

/** Content collections (services on this preset): cell grid by default, cards or rows with images, or text. */
export function LocationsCollection({ ctx, items, variant = "default", columns = 4 }: { ctx: RenderContext; items: SnapshotItem[]; variant?: string; columns?: 2 | 3 | 4 }) {
  // An empty collection renders nothing; the section is left out of the page before this point (B2, D-021).
  if (items.length === 0) return null;
  const v = variant === "default" ? (siteDesign(ctx).cards === "image-side" ? "list" : siteDesign(ctx).cards === "image-top" ? "text" : "text") : variant;
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
            <li key={it.id} className={`overflow-hidden ${locationsStyle.panel}`}>
              {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="aspect-[3/2] w-full object-cover" /> : null}
              <div className="p-4">
                {title(it, "font-extrabold uppercase tracking-wide")}
                {it.payload.summary ? <p className="mt-2 text-sm">{String(it.payload.summary)}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  if (v === "list") {
    return (
      <ul className="divide-y divide-(--section-border) border-y border-(--section-border)">
        {items.map((it) => {
          const img = featuredImage(ctx, it);
          return (
            <li key={it.id} className="flex gap-5 py-4">
              {img ? <Picture ctx={ctx} media={img} sizes="160px" className="aspect-[3/2] w-32 shrink-0 rounded-(--radius) object-cover sm:w-40" /> : null}
              <div className="min-w-0">
                {title(it, "font-extrabold uppercase tracking-wide")}
                {it.payload.summary ? <p className="mt-1 text-sm">{String(it.payload.summary)}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className={`grid gap-px rounded-(--radius) bg-(--section-border) ${columnsClass[columns]}`}>
      {items.map((it) => (
        <li key={it.id} className="bg-(--section-bg) p-5">
          {title(it, "font-extrabold uppercase tracking-wide")}
          {it.payload.summary ? <p className="mt-2 text-sm">{String(it.payload.summary)}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function HeaderImage({ ctx, media }: { ctx: RenderContext; media: SnapshotMedia }) {
  return (
    <PageContainer>
      <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mb-8 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" />
    </PageContainer>
  );
}

export const locationsTheme: Theme = {
  key: "locations",
  render(ctx, route: ResolvedRoute) {
    switch (route.type) {
      case "page": {
        const header = pageHeaderImage(ctx, route.item);
        return (
          <LocationsLayout ctx={ctx}>
            {header ? <HeaderImage ctx={ctx} media={header} /> : null}
            <LocationsSections ctx={ctx} page={route.item.payload as unknown as PagePayload} />
          </LocationsLayout>
        );
      }
      case "detail":
        return <LocationsLayout ctx={ctx}><PageContainer>{route.kind === "store" ? <LocationsStoreDetail ctx={ctx} item={route.item} /> : route.kind === "service" ? <LocationsServiceDetail ctx={ctx} item={route.item} /> : <GenericDetail ctx={ctx} item={route.item} />}</PageContainer></LocationsLayout>;
      case "index":
        return <LocationsLayout ctx={ctx}><PageContainer><LocationsIndex ctx={ctx} kind={route.kind} /></PageContainer></LocationsLayout>;
      case "search":
        return <LocationsLayout ctx={ctx}><PageContainer><LocationsSearch ctx={ctx} /></PageContainer></LocationsLayout>;
      default:
        return null;
    }
  },
};

function GenericDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  return (
    <article className="max-w-3xl">
      <h1 className={h1}>{item.title}</h1>
      {item.payload.summary ? <p className="mt-3 text-lg">{String(item.payload.summary)}</p> : null}
      <RichText ctx={ctx} blocks={(item.payload.body as Block[]) ?? []} className="loc-prose mt-6" />
    </article>
  );
}

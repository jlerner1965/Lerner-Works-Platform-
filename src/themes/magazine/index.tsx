import type { ReactNode } from "react";
import type { Theme, RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { ResolvedRoute } from "@/server/publishing/public-site";
import type { SnapshotItem, SnapshotMedia } from "@/server/publishing/snapshot";
import type { PagePayload, PageSection } from "@/modules/page";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { InquiryForm } from "@/themes/shared/inquiry-form";
import { resolveCollection, resolveCategories, featuredImage, itemPath } from "@/themes/shared/collections";
import { visibleSections } from "@/themes/shared/empty";
import { SiteRoot, BrandMark, siteLogo, linkProps, showSearchLink, pageHeaderImage } from "@/themes/shared/site-root";
import { SectionFrame, PageContainer } from "@/themes/shared/frame";
import { siteDesign, columnsFor, isColouredBand } from "@/themes/shared/design";
import { FaqSection, QuotesSection, CtaBannerSection, GallerySection, FactsSection, VideoSection, MapLinkSection, columnsClass, type SectionStyle } from "@/themes/shared/sections";
import { TeamSection, LogoStripSection, ImageTextSection, ImageBandSection, HeroCollage, heroExtras } from "@/themes/shared/rich-sections";
import { DownloadsSection, Attachments } from "@/themes/shared/documents";
import { LinkCards, LinkIndex, OutsideLinkDetail } from "@/themes/shared/links";
import { formatEventTimeRange, formatDateOnly } from "@/lib/events";
import { MagazinePlaceDetail, MagazineEventDetail, MagazineArticleDetail, MagazineIndex, MagazineSearch } from "@/themes/magazine/pages";
import type { Block } from "@/lib/richtext";

/**
 * Magazine composition for the community guide preset (design programme D2): a centred
 * masthead over a rule-lined navigation, a feature-led home page, dense card grids, kickers
 * in small capitals, serif numerals, a drop cap on long reads and a footer on the text colour.
 * It renders the same section contracts as the guide with its own hierarchy; every colour is a
 * brand or section variable.
 */
export const magFormStyles = {
  wrapper: "mag-form space-y-4 border-y-2 border-(--section-heading) bg-(--section-panel) px-6 py-6 text-(--section-panel-fg)",
  input: "w-full rounded-(--radius) border border-(--brand-border-strong) bg-(--brand-bg) px-3 py-2 text-base text-(--brand-text)",
  label: "mb-1 block text-xs font-semibold uppercase tracking-[0.14em]",
  button: "inline-block rounded-(--radius) bg-(--brand-primary) px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-(--brand-on-primary) hover:opacity-90 disabled:opacity-60",
  error: "text-sm text-(--brand-danger)",
  success: "text-base",
  legend: "text-sm text-(--brand-muted)",
};

export const kicker = "text-[11px] font-semibold uppercase tracking-[0.18em] text-(--section-accent)";

export const magazineStyle: SectionStyle = {
  theme: "magazine",
  heading: (text) => <MagazineHeading>{text}</MagazineHeading>,
  display: "font-(family-name:--font-heading) text-4xl font-bold leading-[1.05] tracking-tight text-(--section-heading) sm:text-6xl",
  subtitle: "font-(family-name:--font-heading) text-2xl font-bold leading-snug text-(--section-heading) sm:text-3xl",
  intro: "mx-auto mt-3 max-w-prose text-center font-(family-name:--font-heading) text-lg italic",
  eyebrow: kicker,
  title: "font-(family-name:--font-heading) text-xl font-bold leading-snug text-(--section-fg)",
  prose: "mag-prose",
  buttonPrimary: "inline-block rounded-(--radius) bg-(--brand-primary) px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-(--brand-on-primary) hover:opacity-90",
  buttonInverse: "inline-block rounded-(--radius) bg-(--section-fg) px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-(--section-bg) hover:opacity-90",
  buttonOutline: "inline-block rounded-(--radius) border-2 border-(--section-fg) px-6 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-(--section-fg) hover:opacity-90",
  panel: "rounded-(--radius) border border-(--section-border) bg-(--section-panel) text-(--section-panel-fg)",
  quote: "font-(family-name:--font-heading) text-2xl italic leading-snug text-(--section-heading)",
  fact: "mt-1 font-(family-name:--font-heading) text-4xl font-bold leading-none text-(--section-heading)",
};

/** Section heading as a magazine department label: small capitals centred between two rules. */
export function MagazineHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-6 flex items-center gap-4 text-center text-sm font-semibold uppercase tracking-[0.18em] text-(--section-heading) before:h-px before:flex-1 before:bg-(--section-border) after:h-px after:flex-1 after:bg-(--section-border)">
      {children}
    </h2>
  );
}

function Display({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-(family-name:--font-heading) font-bold leading-[1.05] tracking-tight text-(--section-heading) ${className}`}>{children}</h1>;
}

function ArrowLink({ ctx, label, path, className = "" }: { ctx: RenderContext; label: string; path: string; className?: string }) {
  if (!label || !path) return null;
  return (
    <a {...linkProps(ctx, path)} className={`inline-block text-sm font-semibold uppercase tracking-[0.14em] text-(--section-accent) underline decoration-2 underline-offset-4 hover:text-(--section-heading) ${className}`}>
      {label}
    </a>
  );
}

export function MagazineLayout({ ctx, children }: { ctx: RenderContext; children: ReactNode }) {
  const { config, site } = ctx.snapshot;
  const year = ctx.now.getFullYear();
  const centered = siteDesign(ctx).header !== "left";
  const cta = config.navigation.cta;
  const navLink = "inline-block py-2 text-[13px] font-semibold uppercase tracking-[0.16em] hover:text-(--brand-accent) aria-[current=page]:text-(--brand-accent)";
  const nav = (
    <nav aria-label="Primary" className={centered ? "border-y-2 border-(--brand-text)" : ""}>
      <ul className={`flex flex-wrap gap-x-7 gap-y-0 ${centered ? "justify-center" : ""}`}>
        {config.navigation.items.map((n) => (
          <li key={n.path}>
            <a {...linkProps(ctx, n.path)} aria-current={ctx.path === n.path ? "page" : undefined} className={navLink}>{n.label}</a>
          </li>
        ))}
        {showSearchLink(ctx) ? (
          <li><a href={href(ctx, "/search")} aria-current={ctx.path === "/search" ? "page" : undefined} className={navLink}>Search</a></li>
        ) : null}
      </ul>
    </nav>
  );
  const button = cta?.label && cta.path ? <a {...linkProps(ctx, cta.path)} className={magazineStyle.buttonPrimary}>{cta.label}</a> : null;
  return (
    <SiteRoot ctx={ctx} themeClass="magazine-theme">
      <a href="#content" className="skip-link">Skip to content</a>
      {ctx.mode === "demo" ? (
        <p className="bg-(--brand-text) px-4 py-1.5 text-center text-xs text-(--brand-on-text)">Demonstration site · {site.name} is fictional; places, events and people are not real.</p>
      ) : null}
      <header className="mx-auto max-w-(--container) px-4">
        {centered ? (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-(--brand-border) py-2 text-xs text-(--brand-muted)">
              <p className="italic">{config.branding.tagline || site.name}</p>
              <p>{new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: site.timeZone }).format(ctx.now)}</p>
            </div>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <a href={href(ctx, "/")} className="inline-flex justify-center">
                <BrandMark ctx={ctx} imageClass="h-14 sm:h-16" textClass="font-(family-name:--font-heading) text-5xl font-bold tracking-tight text-(--brand-primary) sm:text-6xl" />
              </a>
              {button}
            </div>
            {nav}
          </>
        ) : (
          <div className="flex flex-col gap-4 border-b-2 border-(--brand-text) py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <a href={href(ctx, "/")} className="inline-flex items-end">
                <BrandMark ctx={ctx} imageClass="h-10 sm:h-12" textClass="font-(family-name:--font-heading) text-3xl font-bold tracking-tight text-(--brand-primary)" />
              </a>
              {config.branding.tagline ? <p className="mt-0.5 text-sm italic text-(--brand-muted)">{config.branding.tagline}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {nav}
              {button}
            </div>
          </div>
        )}
      </header>
      <main id="content" className="py-10">{children}</main>
      <footer className="mt-20 bg-(--brand-text) text-(--brand-on-text)">
        <div className={`mx-auto max-w-(--container) px-4 py-12 ${config.footer.variant === "compact" ? "flex flex-col gap-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" : "grid gap-10 sm:grid-cols-3"}`}>
          <div>
            <p className="font-(family-name:--font-heading) text-2xl font-bold">
              {siteLogo(ctx, "dark") ? <BrandMark ctx={ctx} surface="dark" imageClass="h-10" textClass="" /> : config.branding.wordmark}
            </p>
            {config.footer.text ? <p className="mt-3 max-w-xs text-sm">{config.footer.text}</p> : null}
          </div>
          {config.footer.showContactDetails && config.footer.variant !== "compact" ? (
            <div className="text-sm">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]">Contact</p>
              {site.contact.email ? <p><a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a></p> : null}
              {site.contact.phone ? <p>{site.contact.phone}</p> : null}
              {site.contact.address ? <p className="mt-1 whitespace-pre-line">{site.contact.address}</p> : null}
            </div>
          ) : null}
          <div className={`text-sm ${config.footer.variant === "compact" ? "sm:text-right" : ""}`}>
            {config.footer.variant !== "compact" ? <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]">Sections</p> : null}
            {config.footer.links.length ? (
              <ul className={config.footer.variant === "compact" ? "flex flex-wrap gap-x-4 gap-y-1 sm:justify-end" : "space-y-1"}>
                {config.footer.links.map((l) => <li key={l.path}><a {...linkProps(ctx, l.path)} className="underline">{l.label}</a></li>)}
              </ul>
            ) : null}
            {config.footer.variant === "compact" && config.footer.showContactDetails && site.contact.email ? <p className="mt-1"><a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a></p> : null}
            <p className="mt-4 text-xs">© {year} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
          </div>
        </div>
      </footer>
    </SiteRoot>
  );
}

/** Section types that read best at prose width unless the owner widens them. */
const narrowByDefault = new Set<PageSection["type"]>(["rich_text", "inquiry_form", "faq", "video", "map_link", "downloads"]);

export function MagazineSections({ ctx, page }: { ctx: RenderContext; page: PagePayload }) {
  // Sections with nothing to show are left out (B2, D-021); publication lists them.
  const sections = visibleSections(ctx, page.sections);
  return (
    <div className="space-y-(--section-gap)">
      {sections.map((section, index) =>
        section.type === "image_band" ? (
          // The photo band spans the full width and sets its own colours, so it renders without the section frame (B3).
          <ImageBandSection key={section.id} ctx={ctx} section={section} style={magazineStyle} />
        ) : (
          <SectionFrame key={section.id} appearance={section.appearance} narrow={narrowByDefault.has(section.type) || (section.type === "quotes" && (section.variant === "single" || (section.variant === "default" && section.items.length <= 1)))}>
            <MagazineSection ctx={ctx} section={section} first={index === 0} />
          </SectionFrame>
        ),
      )}
    </div>
  );
}

const overlayClass = { light: "lw-hero-overlay-light", medium: "lw-hero-overlay-medium", strong: "lw-hero-overlay-strong" } as const;

function ImageHero({ ctx, section }: { ctx: RenderContext; section: Extract<PageSection, { type: "image_hero" }> }) {
  const media = section.imageAssetId ? ctx.snapshot.media[section.imageAssetId] : null;
  const variant = section.variant === "default" ? siteDesign(ctx).hero : section.variant;
  const centered = section.appearance.align === "center";
  const text = (
    <>
      <Display className="text-4xl sm:text-6xl">{section.heading}</Display>
      {section.subheading ? <p className={`mt-4 max-w-prose font-(family-name:--font-heading) text-xl italic leading-relaxed ${centered ? "mx-auto" : ""}`}>{section.subheading}</p> : null}
      <div className="mt-6"><ArrowLink ctx={ctx} label={section.ctaLabel} path={section.ctaPath} /></div>
    </>
  );
  // B3 treatments: a display-size heading over the picture, the words overlapping the picture from the right, the picture with up to three more.
  if (variant === "statement") {
    return (
      <div className={centered ? "text-center" : ""}>
        <div className={`max-w-5xl ${centered ? "mx-auto" : ""}`}>
          <Display className="text-6xl sm:text-8xl lg:text-9xl">{section.heading}</Display>
          {section.subheading ? <p className={`mt-6 max-w-2xl font-(family-name:--font-heading) text-xl italic leading-relaxed ${centered ? "mx-auto" : ""}`}>{section.subheading}</p> : null}
          <div className="mt-6"><ArrowLink ctx={ctx} label={section.ctaLabel} path={section.ctaPath} /></div>
        </div>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mt-10 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
      </div>
    );
  }
  if (variant === "offset" && media) {
    return (
      <div className="md:grid md:grid-cols-12 md:items-end">
        <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 66vw, 100vw" className="aspect-[16/10] w-full rounded-(--radius) object-cover md:col-span-8 md:col-start-1 md:row-start-1" loading="eager" fetchPriority="high" />
        <div className="relative mx-4 -mt-12 border-t-2 border-(--section-heading) bg-(--section-bg) p-6 md:col-span-6 md:col-start-7 md:row-start-1 md:mx-0 md:mb-10 md:p-8">{text}</div>
      </div>
    );
  }
  if (variant === "collage" && media) {
    return (
      <div>
        <div className={`max-w-3xl ${centered ? "mx-auto text-center" : "border-l-4 border-(--section-accent) pl-6"}`}>{text}</div>
        <HeroCollage ctx={ctx} main={media} extras={heroExtras(ctx, section)} className="mt-8" />
      </div>
    );
  }
  if (variant === "full") {
    return (
      <div className="relative overflow-hidden rounded-(--radius) bg-(--brand-text) text-(--brand-on-text)" style={{ "--section-heading": "var(--brand-on-text)", "--section-accent": "var(--brand-on-text)", "--section-fg": "var(--brand-on-text)", "--section-bg": "var(--brand-text)" } as React.CSSProperties}>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="absolute inset-0 h-full w-full object-cover" loading="eager" fetchPriority="high" /> : null}
        <div className={`relative flex min-h-[26rem] flex-col justify-end px-6 py-12 sm:min-h-[32rem] md:px-12 ${media ? overlayClass[section.overlay] : ""}`}>
          <div className={`max-w-3xl border-t-2 border-(--brand-on-text) pt-6 ${centered ? "mx-auto text-center" : ""}`}>{text}</div>
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
  // split: the picture leads, the words follow; without a picture the words stand on their own (no placeholder box, B2).
  if (!media) return <div className={`max-w-3xl border-l-4 border-(--section-accent) pl-6 ${centered ? "mx-auto" : ""}`}>{text}</div>;
  return (
    <div className="grid items-center gap-10 md:grid-cols-[6fr_5fr]">
      <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 55vw, 100vw" className="aspect-[4/3] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" />
      <div className="border-l-4 border-(--section-accent) pl-6">{text}</div>
    </div>
  );
}

function MagazineSection({ ctx, section, first }: { ctx: RenderContext; section: PageSection; first: boolean }) {
  const onBand = isColouredBand(section.appearance.background);
  switch (section.type) {
    case "image_hero":
      return <ImageHero ctx={ctx} section={section} />;
    case "text_hero": {
      const statement = section.variant === "statement";
      const compact = section.variant === "compact";
      const start = section.appearance.align === "start";
      return (
        <div className={`${compact ? "pb-4" : statement ? "py-6" : "border-y-2 border-(--section-heading) py-10"} ${start ? "" : "text-center"}`}>
          <Display className={statement ? "text-6xl sm:text-8xl" : compact ? "text-3xl sm:text-4xl" : "text-5xl sm:text-7xl"}>{section.heading}</Display>
          {section.subheading ? <p className={`mt-5 max-w-2xl font-(family-name:--font-heading) text-xl italic leading-relaxed ${start ? "" : "mx-auto"}`}>{section.subheading}</p> : null}
          <div className="mt-6"><ArrowLink ctx={ctx} label={section.ctaLabel} path={section.ctaPath} /></div>
        </div>
      );
    }
    case "rich_text":
      return (
        <>
          {section.heading ? (first ? <Display className="mb-8 text-center text-4xl sm:text-5xl">{section.heading}</Display> : <MagazineHeading>{section.heading}</MagazineHeading>) : null}
          {section.body.length ? (
            <RichText ctx={ctx} blocks={section.body as Block[]} className={`mag-prose ${first ? "mag-dropcap" : ""} ${section.variant === "columns" ? "md:columns-2 md:gap-12" : ""} ${section.variant === "lead" ? "[&>p:first-child]:font-(family-name:--font-heading) [&>p:first-child]:text-2xl [&>p:first-child]:italic [&>p:first-child]:leading-relaxed" : ""}`} />
          ) : null}
        </>
      );
    case "feature_list": {
      const variant = section.variant === "default" ? "grid" : section.variant;
      const columns = columnsFor("magazine", "feature_list", section.columns);
      const item = (it: (typeof section.items)[number], i: number) => (
        <>
          <p className="font-(family-name:--font-heading) text-3xl font-bold leading-none text-(--section-accent)">{String(i + 1).padStart(2, "0")}</p>
          {it.path ? (
            <a {...linkProps(ctx, it.path)} className="mt-2 block font-(family-name:--font-heading) text-xl font-bold leading-snug text-(--section-heading) hover:underline">{it.title}</a>
          ) : (
            <p className="mt-2 font-(family-name:--font-heading) text-xl font-bold leading-snug">{it.title}</p>
          )}
          {it.text ? <p className="mt-1 text-sm text-(--section-muted)">{it.text}</p> : null}
        </>
      );
      return (
        <>
          {section.heading ? <MagazineHeading>{section.heading}</MagazineHeading> : null}
          {section.items.length === 0 ? null : variant === "list" ? (
            <ol className="divide-y divide-(--section-border) border-y border-(--section-border)">
              {section.items.map((it, i) => <li key={it.title} className="flex items-baseline gap-5 py-4">{item(it, i)}</li>)}
            </ol>
          ) : variant === "cards" ? (
            <ol className={`grid gap-5 ${columnsClass[columns]}`}>
              {section.items.map((it, i) => <li key={it.title} className={`${magazineStyle.panel} p-5`}>{item(it, i)}</li>)}
            </ol>
          ) : (
            <ol className={`grid gap-x-10 gap-y-8 ${columnsClass[columns]}`}>
              {section.items.map((it, i) => <li key={it.title} className="border-t-2 border-(--section-heading) pt-4">{item(it, i)}</li>)}
            </ol>
          )}
        </>
      );
    }
    case "content_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <>
          {section.heading ? <MagazineHeading>{section.heading}</MagazineHeading> : null}
          {section.kind === "link" ? <LinkCards ctx={ctx} items={items} style={magazineStyle} columns={columnsFor("magazine", "content_collection", section.columns)} variant={section.variant} /> : <MagazineCollection ctx={ctx} kind={section.kind} items={items} mode={section.mode} variant={section.variant} columns={columnsFor("magazine", "content_collection", section.columns)} />}
        </>
      );
    }
    case "location_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <>
          {section.heading ? <MagazineHeading>{section.heading}</MagazineHeading> : null}
          <MagazineCollection ctx={ctx} kind="store" items={items} mode="latest" variant={section.variant} columns={columnsFor("magazine", "location_collection", section.columns)} />
        </>
      );
    }
    case "category_list": {
      const categories = resolveCategories(ctx, section);
      if (categories.length === 0) return null;
      const variant = section.variant === "default" ? "grid" : section.variant;
      const count = (n: number) => (section.showCounts ? <span className="text-sm text-(--section-muted)"> ({n})</span> : null);
      const link = "font-(family-name:--font-heading) text-xl font-bold leading-snug text-(--section-heading) hover:underline";
      return (
        <>
          {section.heading ? <MagazineHeading>{section.heading}</MagazineHeading> : null}
          {variant === "chips" ? (
            <ul className="flex flex-wrap justify-center gap-2 text-sm">
              {categories.map((c) => (
                <li key={c.name}><a href={href(ctx, c.path)} className="inline-block rounded-(--radius) border border-(--brand-border-strong) px-3 py-1 font-semibold uppercase tracking-[0.12em] hover:border-(--section-heading) hover:text-(--section-heading)">{c.name}{count(c.count)}</a></li>
              ))}
            </ul>
          ) : variant === "list" ? (
            <ol className="divide-y divide-(--section-border) border-y border-(--section-border)">
              {categories.map((c, i) => <li key={c.name} className="flex items-baseline gap-5 py-4"><span className={kicker}>{String(i + 1).padStart(2, "0")}</span><a href={href(ctx, c.path)} className={link}>{c.name}</a>{count(c.count)}</li>)}
            </ol>
          ) : (
            <ol className={`grid gap-x-10 gap-y-8 ${columnsClass[columnsFor("magazine", "category_list", section.columns)]}`}>
              {categories.map((c, i) => (
                <li key={c.name} className="border-t-2 border-(--section-heading) pt-4">
                  <p className="font-(family-name:--font-heading) text-3xl font-bold leading-none text-(--section-accent)">{String(i + 1).padStart(2, "0")}</p>
                  <a href={href(ctx, c.path)} className={`mt-2 block ${link}`}>{c.name}</a>
                  {section.showCounts ? <p className="mt-1 text-sm text-(--section-muted)">{c.count} {c.count === 1 ? "place" : "places"}</p> : null}
                </li>
              ))}
            </ol>
          )}
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
      const boxed = section.appearance.background === "default" ? "border-y-2 border-(--section-heading) bg-(--section-panel) text-(--section-panel-fg)" : "";
      if (section.variant === "banner") {
        return (
          <div className={`px-6 py-10 text-center ${boxed}`}>
            <p className={kicker}>Get in touch</p>
            <h2 className="mt-2 font-(family-name:--font-heading) text-3xl font-bold text-(--section-heading) sm:text-4xl">{section.heading}</h2>
            {section.text ? <p className="mx-auto mt-3 max-w-prose">{section.text}</p> : null}
            {details}
            <p className="mt-5"><a href={href(ctx, "/contact")} className={onBand ? magazineStyle.buttonInverse : magazineStyle.buttonPrimary}>Contact page</a></p>
          </div>
        );
      }
      const split = section.variant === "split";
      return (
        <div className={`px-6 py-6 ${boxed} ${split ? "grid gap-6 md:grid-cols-[3fr_2fr] md:items-center" : ""}`}>
          <div>
            <p className={kicker}>Get in touch</p>
            <h2 className="mt-1 font-(family-name:--font-heading) text-2xl font-bold text-(--section-heading)">{section.heading}</h2>
            {section.text ? <p className="mt-2 max-w-prose">{section.text}</p> : null}
            {details}
          </div>
          <p className={split ? "md:justify-self-end" : "mt-4"}><a href={href(ctx, "/contact")} className={onBand ? magazineStyle.buttonInverse : magazineStyle.buttonPrimary}>Contact page</a></p>
        </div>
      );
    }
    case "inquiry_form": {
      const locations = section.locationSelect ? Object.values(ctx.snapshot.items).filter((i) => i.kind === "place" || i.kind === "store").map((i) => ({ id: i.id, label: i.title })) : [];
      return (
        <div className={section.variant === "wide" ? "" : "mx-auto max-w-2xl"}>
          <InquiryForm endpoint={ctx.inquiryEndpoint} heading={section.heading} intro={section.intro} sourcePath={ctx.path} locations={locations} styles={magFormStyles} />
        </div>
      );
    }
    case "faq":
      return <FaqSection ctx={ctx} section={section} style={magazineStyle} />;
    case "quotes":
      return <QuotesSection ctx={ctx} section={section} style={magazineStyle} />;
    case "cta_banner":
      return <CtaBannerSection ctx={ctx} section={section} style={magazineStyle} />;
    case "gallery":
      return <GallerySection ctx={ctx} section={section} style={magazineStyle} />;
    case "facts":
      return <FactsSection section={section} style={magazineStyle} />;
    case "video":
      return <VideoSection ctx={ctx} section={section} style={magazineStyle} />;
    case "map_link":
      return <MapLinkSection ctx={ctx} section={section} style={magazineStyle} />;
    case "team":
      return <TeamSection ctx={ctx} section={section} style={magazineStyle} />;
    case "logo_strip":
      return <LogoStripSection ctx={ctx} section={section} style={magazineStyle} />;
    case "image_text":
      return <ImageTextSection ctx={ctx} section={section} style={magazineStyle} />;
    case "downloads":
      return <DownloadsSection ctx={ctx} section={section} style={magazineStyle} />;
    case "image_band":
      // Rendered by MagazineSections outside the section frame.
      return null;
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

function venueLabel(ctx: RenderContext, ev: SnapshotItem): string {
  const venueId = ev.payload.venueItemId;
  if (typeof venueId === "string" && ctx.snapshot.items[venueId]) return ctx.snapshot.items[venueId]!.title;
  return String(ev.payload.venueText ?? "");
}

/** Collections in the magazine composition: a lead story with a grid, cards with kickers, rows with a date block, or plain text rows. */
export function MagazineCollection({ ctx, kind, items, mode, variant = "default", columns = 3 }: { ctx: RenderContext; kind: string; items: SnapshotItem[]; mode: string; variant?: string; columns?: 2 | 3 | 4 }) {
  // An empty collection renders nothing; the section is left out of the page before this point (B2, D-021).
  if (items.length === 0) return null;
  void mode;
  const v = resolveCollectionVariant(ctx, kind, variant);
  const eyebrow = (it: SnapshotItem): string => {
    if (kind === "event") {
      const d = eventDate(it);
      return `${d.mon} ${d.day}${it.payload.status === "cancelled" ? " · Cancelled" : ""}`;
    }
    if (kind === "article") return formatDateOnly(String(it.payload.publishedOn));
    return it.payload.category ? String(it.payload.category) : "";
  };
  const meta = (it: SnapshotItem): string => {
    if (kind === "event") return `${formatEventTimeRange(String(it.payload.startsAt), String(it.payload.endsAt), eventDate(it).tz)}${venueLabel(ctx, it) ? ` · ${venueLabel(ctx, it)}` : ""}`;
    if (kind === "article") return `By ${String(it.payload.authorName)}`;
    return "";
  };
  const titleLink = (it: SnapshotItem, className: string) => {
    const p = itemPath(ctx, it);
    return <h3 className={className}>{p ? <a href={href(ctx, p)} className="hover:underline">{it.title}</a> : it.title}</h3>;
  };

  if (kind === "event" && v === "list") {
    return (
      <ol className="divide-y divide-(--section-border) border-y-2 border-(--section-heading)">
        {items.map((ev) => {
          const d = eventDate(ev);
          return (
            <li key={ev.id} className="grid gap-4 py-5 sm:grid-cols-[6rem_1fr]">
              <div className="border-r-2 border-(--section-accent) pr-4 text-right">
                <p className={kicker}>{d.mon}</p>
                <p className="font-(family-name:--font-heading) text-4xl font-bold leading-none">{d.day}</p>
              </div>
              <div className="min-w-0">
                <p className="font-(family-name:--font-heading) text-2xl font-bold leading-snug">
                  {itemPath(ctx, ev) ? <a href={href(ctx, itemPath(ctx, ev)!)} className="hover:underline">{ev.title}</a> : ev.title}
                  {ev.payload.status === "cancelled" ? <span className="ml-2 align-middle text-xs font-bold uppercase tracking-wider text-(--brand-danger)">Cancelled</span> : null}
                </p>
                <p className="mt-1 text-sm text-(--section-muted)">{meta(ev)}</p>
                {ev.payload.summary ? <p className="mt-1 max-w-prose">{String(ev.payload.summary)}</p> : null}
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
      <div>
        <article className="grid items-center gap-8 md:grid-cols-2">
          {leadImg ? <Picture ctx={ctx} media={leadImg} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3] w-full rounded-(--radius) object-cover" /> : null}
          <div className={leadImg ? "" : "md:col-span-2 text-center"}>
            <p className={kicker}>{kind === "article" ? "Lead story" : eyebrow(lead)}</p>
            {titleLink(lead, "mt-2 font-(family-name:--font-heading) text-3xl font-bold leading-tight sm:text-4xl")}
            {lead.payload.summary ? <p className="mt-3 font-(family-name:--font-heading) text-lg italic leading-relaxed text-(--section-muted)">{String(lead.payload.summary)}</p> : null}
            <p className="mt-3 text-sm text-(--section-muted)">{[meta(lead), kind === "article" ? eyebrow(lead) : ""].filter(Boolean).join(" · ")}</p>
          </div>
        </article>
        {rest.length ? (
          <ul className={`mt-10 grid gap-x-8 gap-y-6 border-t border-(--section-border) pt-8 ${columnsClass[columns]}`}>
            {rest.map((a) => {
              const img = featuredImage(ctx, a);
              return (
                <li key={a.id}>
                  {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="mb-3 aspect-[3/2] w-full rounded-(--radius) object-cover" /> : null}
                  {eyebrow(a) ? <p className={kicker}>{eyebrow(a)}</p> : null}
                  {titleLink(a, "mt-1 font-(family-name:--font-heading) text-xl font-bold leading-snug")}
                  {meta(a) ? <p className="mt-1 text-sm text-(--section-muted)">{meta(a)}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }
  if (v === "list") {
    return (
      <ul className="divide-y divide-(--section-border) border-y-2 border-(--section-heading)">
        {items.map((it) => {
          const img = featuredImage(ctx, it);
          return (
            <li key={it.id} className="grid gap-5 py-5 sm:grid-cols-[10rem_1fr]">
              {img ? <Picture ctx={ctx} media={img} sizes="160px" className="aspect-[4/3] w-full rounded-(--radius) object-cover" /> : <div />}
              <div className="min-w-0">
                {eyebrow(it) ? <p className={kicker}>{eyebrow(it)}</p> : null}
                {titleLink(it, "mt-1 font-(family-name:--font-heading) text-2xl font-bold leading-snug")}
                {meta(it) ? <p className="mt-1 text-sm text-(--section-muted)">{meta(it)}</p> : null}
                {it.payload.summary ? <p className="mt-2 max-w-prose">{String(it.payload.summary)}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  if (v === "text") {
    return (
      <ul className={`grid gap-x-10 gap-y-6 ${columnsClass[columns]}`}>
        {items.map((it) => (
          <li key={it.id} className="border-t-2 border-(--section-heading) pt-3">
            {eyebrow(it) ? <p className={kicker}>{eyebrow(it)}</p> : null}
            {titleLink(it, "mt-1 font-(family-name:--font-heading) text-xl font-bold leading-snug")}
            {it.payload.summary ? <p className="mt-1 text-sm text-(--section-muted)">{String(it.payload.summary)}</p> : null}
          </li>
        ))}
      </ul>
    );
  }
  // cards: image on top with a kicker and a rule under the picture
  return (
    <ul className={`grid gap-x-8 gap-y-10 ${columnsClass[columns]}`}>
      {items.map((it) => {
        const img = featuredImage(ctx, it);
        return (
          <li key={it.id}>
            {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="mb-4 aspect-[3/2] w-full rounded-(--radius) object-cover" /> : null}
            <div className="border-t-2 border-(--section-heading) pt-3">
              {eyebrow(it) ? <p className={kicker}>{eyebrow(it)}</p> : null}
              {titleLink(it, "mt-1 font-(family-name:--font-heading) text-2xl font-bold leading-snug")}
              {meta(it) ? <p className="mt-1 text-sm text-(--section-muted)">{meta(it)}</p> : null}
              {it.payload.summary ? <p className="mt-2 text-sm text-(--section-muted)">{String(it.payload.summary)}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function HeaderImage({ ctx, media }: { ctx: RenderContext; media: SnapshotMedia }) {
  return (
    <PageContainer>
      <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mb-10 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" />
    </PageContainer>
  );
}

function GenericDetail({ ctx, item }: { ctx: RenderContext; item: SnapshotItem }) {
  const p = item.payload as Record<string, unknown>;
  return (
    <article className="mx-auto max-w-3xl">
      <Display className="text-center text-4xl">{item.title}</Display>
      {p.summary ? <p className="mt-4 text-center font-(family-name:--font-heading) text-xl italic">{String(p.summary)}</p> : null}
      <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className="mag-prose mt-8" />
      <Attachments ctx={ctx} item={item} style={magazineStyle} />
    </article>
  );
}

export const magazineTheme: Theme = {
  key: "magazine",
  render(ctx, route: ResolvedRoute) {
    switch (route.type) {
      case "page": {
        const page = route.item.payload as unknown as PagePayload;
        const header = pageHeaderImage(ctx, route.item);
        return (
          <MagazineLayout ctx={ctx}>
            {header ? <HeaderImage ctx={ctx} media={header} /> : null}
            <MagazineSections ctx={ctx} page={page} />
          </MagazineLayout>
        );
      }
      case "detail":
        return (
          <MagazineLayout ctx={ctx}>
            <PageContainer>
              {route.kind === "link" ? <OutsideLinkDetail ctx={ctx} item={route.item} style={magazineStyle} /> : route.kind === "place" ? <MagazinePlaceDetail ctx={ctx} item={route.item} /> : route.kind === "event" ? <MagazineEventDetail ctx={ctx} item={route.item} /> : route.kind === "article" ? <MagazineArticleDetail ctx={ctx} item={route.item} /> : <GenericDetail ctx={ctx} item={route.item} />}
            </PageContainer>
          </MagazineLayout>
        );
      case "index":
        return (
          <MagazineLayout ctx={ctx}>
            <PageContainer>{route.kind === "link" ? <LinkIndex ctx={ctx} style={magazineStyle} /> : <MagazineIndex ctx={ctx} kind={route.kind} />}</PageContainer>
          </MagazineLayout>
        );
      case "search":
        return (
          <MagazineLayout ctx={ctx}>
            <PageContainer><MagazineSearch ctx={ctx} /></PageContainer>
          </MagazineLayout>
        );
      default:
        return null;
    }
  },
};

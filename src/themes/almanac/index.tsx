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
import { SiteRoot, BrandMark, linkProps, showSearchLink, pageHeaderImage } from "@/themes/shared/site-root";
import { SectionFrame, PageContainer } from "@/themes/shared/frame";
import { siteDesign, columnsFor, isColouredBand } from "@/themes/shared/design";
import { FaqSection, QuotesSection, CtaBannerSection, GallerySection, FactsSection, VideoSection, MapLinkSection, columnsClass, type SectionStyle } from "@/themes/shared/sections";
import { TeamSection, LogoStripSection, ImageTextSection, ImageBandSection, HeroCollage, heroExtras } from "@/themes/shared/rich-sections";
import { formatEventTimeRange, formatDateOnly } from "@/lib/events";
import { AlmanacPlaceDetail, AlmanacEventDetail, AlmanacArticleDetail, AlmanacIndex, AlmanacSearch } from "@/themes/almanac/pages";
import type { Block } from "@/lib/richtext";

/**
 * Almanac composition for the community guide preset (site-building programme B3): a
 * navigation rail down the left with numbered entries, sections numbered by a CSS counter,
 * hairline rules, small-caps labels, tabular numerals, reference listings with square
 * thumbnails and fact sheets for places. The same section contracts as the guide with a
 * reference book's hierarchy; every colour is a brand or section variable.
 */
export const almFormStyles = {
  wrapper: "alm-form space-y-4 border border-(--section-border) bg-(--section-panel) p-6 text-(--section-panel-fg)",
  input: "w-full rounded-(--radius) border border-(--brand-border-strong) bg-(--brand-bg) px-3 py-2 text-base text-(--brand-text)",
  label: "mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em]",
  button: "inline-block rounded-(--radius) border-2 border-(--brand-primary) bg-(--brand-primary) px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-(--brand-on-primary) hover:bg-(--brand-bg) hover:text-(--brand-primary) disabled:opacity-60",
  error: "text-sm text-(--brand-danger)",
  success: "text-base",
  legend: "text-sm text-(--brand-muted)",
};

export const almEyebrow = "text-[11px] font-semibold uppercase tracking-[0.16em] text-(--section-accent)";

export const almanacStyle: SectionStyle = {
  theme: "almanac",
  heading: (text) => <AlmanacHeading>{text}</AlmanacHeading>,
  display: "font-(family-name:--font-heading) text-4xl font-bold leading-tight tracking-tight text-(--section-heading) sm:text-5xl",
  subtitle: "font-(family-name:--font-heading) text-2xl font-bold tracking-tight text-(--section-heading)",
  intro: "mt-2 max-w-prose text-lg",
  eyebrow: almEyebrow,
  title: "font-(family-name:--font-heading) text-lg font-bold tracking-tight text-(--section-fg)",
  prose: "alm-prose",
  buttonPrimary: "inline-block rounded-(--radius) border-2 border-(--brand-primary) bg-(--brand-primary) px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-(--brand-on-primary) hover:bg-(--brand-bg) hover:text-(--brand-primary)",
  buttonInverse: "inline-block rounded-(--radius) border-2 border-(--section-fg) bg-(--section-fg) px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-(--section-bg) hover:opacity-90",
  buttonOutline: "inline-block rounded-(--radius) border-2 border-(--section-fg) px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-(--section-fg) hover:opacity-90",
  panel: "rounded-(--radius) border border-(--section-border) bg-(--section-panel) text-(--section-panel-fg)",
  quote: "font-(family-name:--font-heading) leading-snug text-(--section-heading)",
  fact: "mt-1 font-(family-name:--font-heading) text-3xl font-bold tabular-nums text-(--section-heading)",
};

/** The call-to-action banner keeps a display heading: a numbered small-caps label would undersell it. */
const almanacBannerStyle: SectionStyle = { ...almanacStyle, heading: (text) => <h2 className={`mb-2 ${almanacStyle.display}`}>{text}</h2> };

/** Section heading numbered by a CSS counter (`.alm-heading` in globals.css): "01  Heading" over a hairline. */
export function AlmanacHeading({ children }: { children: ReactNode }) {
  return <h2 className="alm-heading mb-5 flex items-baseline gap-3 border-b border-(--section-border) pb-2 text-sm font-semibold uppercase tracking-[0.16em] text-(--section-heading)">{children}</h2>;
}

export const almH1 = "font-(family-name:--font-heading) text-4xl font-bold leading-tight tracking-tight text-(--section-heading)";

function TextLink({ ctx, label, path }: { ctx: RenderContext; label: string; path: string }) {
  if (!label || !path) return null;
  return <a {...linkProps(ctx, path)} className="inline-block text-sm font-semibold uppercase tracking-[0.12em] text-(--section-accent) underline decoration-2 underline-offset-4 hover:text-(--section-heading)">{label}</a>;
}

export function AlmanacLayout({ ctx, children }: { ctx: RenderContext; children: ReactNode }) {
  const { config, site } = ctx.snapshot;
  const year = ctx.now.getFullYear();
  const rail = siteDesign(ctx).header !== "centered";
  const cta = config.navigation.cta;
  const button = cta?.label && cta.path ? <a {...linkProps(ctx, cta.path)} className={almanacStyle.buttonPrimary}>{cta.label}</a> : null;
  const entries = [...config.navigation.items, ...(showSearchLink(ctx) ? [{ label: "Search", path: "/search" }] : [])];
  const nav = (
    <nav aria-label="Primary">
      <ol className={rail ? "flex flex-wrap gap-x-5 gap-y-1 lg:block lg:border-t lg:border-(--brand-border)" : "flex flex-wrap justify-center gap-x-6 gap-y-1"}>
        {entries.map((n, i) => (
          <li key={n.path} className={rail ? "lg:border-b lg:border-(--brand-border)" : ""}>
            <a {...linkProps(ctx, n.path)} aria-current={ctx.path === n.path ? "page" : undefined} className="group inline-flex items-baseline gap-3 py-1.5 text-[13px] font-semibold uppercase tracking-[0.14em] hover:text-(--brand-accent) aria-[current=page]:text-(--brand-accent)">
              <span className="text-xs tabular-nums text-(--brand-muted) group-hover:text-(--brand-accent)">{String(i + 1).padStart(2, "0")}</span>
              {n.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
  const brand = (
    <div>
      <a href={href(ctx, "/")} className="inline-flex">
        <BrandMark ctx={ctx} imageClass="h-10" textClass="font-(family-name:--font-heading) text-2xl font-bold tracking-tight text-(--brand-primary)" />
      </a>
      {config.branding.tagline ? <p className="mt-1 text-sm text-(--brand-muted)">{config.branding.tagline}</p> : null}
    </div>
  );
  const contact = config.footer.showContactDetails && (site.contact.email || site.contact.phone) ? (
    <p>
      {site.contact.email ? <a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a> : null}
      {site.contact.email && site.contact.phone ? <br /> : null}
      {site.contact.phone}
    </p>
  ) : null;
  return (
    <SiteRoot ctx={ctx} themeClass="almanac-theme">
      <a href="#content" className="skip-link">Skip to content</a>
      {ctx.mode === "demo" ? (
        <p className="bg-(--brand-text) px-4 py-1.5 text-center text-xs text-(--brand-on-text)">Demonstration site · {site.name} is fictional; places, events and people are not real.</p>
      ) : null}
      <div className={rail ? "lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]" : ""}>
        <header className={rail ? "border-b border-(--brand-border) lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r" : "border-b border-(--brand-border)"}>
          {rail ? (
            <div className="flex flex-col gap-5 px-5 py-6 lg:min-h-full">
              {brand}
              {nav}
              {button ? <div>{button}</div> : null}
              <div className="space-y-2 text-xs text-(--brand-muted) lg:mt-auto lg:pt-6">
                {contact}
                <p>© {year} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-(--container) flex-col items-center gap-4 px-4 py-6 text-center">
              {brand}
              {nav}
              {button}
            </div>
          )}
        </header>
        <div className="min-w-0">
          <main id="content" className="py-8 lg:py-10">{children}</main>
          <footer className="mt-16 border-t border-(--brand-border) bg-(--brand-surface) text-sm">
            {config.footer.variant === "compact" ? (
              <div className="mx-auto flex max-w-(--container) flex-col gap-4 px-4 py-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <BrandMark ctx={ctx} imageClass="h-8" textClass="font-(family-name:--font-heading) text-lg font-bold text-(--brand-primary)" />
                  {config.footer.text ? <p className="max-w-md">{config.footer.text}</p> : null}
                  {!rail ? contact : null}
                </div>
                <div className="sm:text-right">
                  {config.footer.links.length ? (
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 sm:justify-end">
                      {config.footer.links.map((l) => <li key={l.path}><a {...linkProps(ctx, l.path)} className="underline">{l.label}</a></li>)}
                    </ul>
                  ) : null}
                  <p className="mt-2 text-xs text-(--brand-muted)">© {year} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
                </div>
              </div>
            ) : (
              <div className="mx-auto grid max-w-(--container) gap-8 px-4 py-10 sm:grid-cols-3">
                <div>
                  <BrandMark ctx={ctx} imageClass="h-8" textClass="font-(family-name:--font-heading) text-lg font-bold text-(--brand-primary)" />
                  {config.footer.text ? <p className="mt-2 max-w-xs">{config.footer.text}</p> : null}
                </div>
                {config.footer.showContactDetails ? (
                  <div>
                    <p className={`mb-2 ${almEyebrow}`}>Contact</p>
                    {site.contact.email ? <p><a href={`mailto:${site.contact.email}`} className="underline">{site.contact.email}</a></p> : null}
                    {site.contact.phone ? <p>{site.contact.phone}</p> : null}
                    {site.contact.address ? <p className="mt-1 whitespace-pre-line">{site.contact.address}</p> : null}
                  </div>
                ) : null}
                <div>
                  <p className={`mb-2 ${almEyebrow}`}>Index</p>
                  <ul className="space-y-1">
                    {config.footer.links.map((l) => <li key={l.path}><a {...linkProps(ctx, l.path)} className="underline">{l.label}</a></li>)}
                  </ul>
                  <p className="mt-4 text-xs text-(--brand-muted)">© {year} {config.branding.wordmark}. Release {ctx.releaseVersion}.</p>
                </div>
              </div>
            )}
          </footer>
        </div>
      </div>
    </SiteRoot>
  );
}

/** Section types that read best at prose width unless the owner widens them. */
const narrowByDefault = new Set<PageSection["type"]>(["rich_text", "inquiry_form", "faq", "video", "map_link"]);

export function AlmanacSections({ ctx, page }: { ctx: RenderContext; page: PagePayload }) {
  // Sections with nothing to show are left out (B2, D-021); publication lists them.
  const sections = visibleSections(ctx, page.sections);
  return (
    <div className="space-y-(--section-gap)">
      {sections.map((section, index) =>
        section.type === "image_band" ? (
          <ImageBandSection key={section.id} ctx={ctx} section={section} style={almanacStyle} />
        ) : (
          <SectionFrame key={section.id} appearance={section.appearance} narrowAlign="start" narrow={narrowByDefault.has(section.type) || (section.type === "quotes" && (section.variant === "single" || (section.variant === "default" && section.items.length <= 1)))}>
            <AlmanacSection ctx={ctx} section={section} first={index === 0} />
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
  const text = (large: boolean) => (
    <>
      <h1 className={`font-(family-name:--font-heading) font-bold leading-[1.05] tracking-tight text-(--section-heading) ${large ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl"}`}>{section.heading}</h1>
      {section.subheading ? <p className={`mt-4 max-w-prose text-lg leading-relaxed ${centered ? "mx-auto" : ""}`}>{section.subheading}</p> : null}
      <div className="mt-6"><TextLink ctx={ctx} label={section.ctaLabel} path={section.ctaPath} /></div>
    </>
  );
  if (variant === "statement") {
    return (
      <div className={centered ? "text-center" : ""}>
        <div className={`max-w-5xl ${centered ? "mx-auto" : ""}`}>
          <h1 className="font-(family-name:--font-heading) text-5xl font-bold leading-none tracking-tight text-(--section-heading) sm:text-7xl lg:text-8xl">{section.heading}</h1>
          {section.subheading ? <p className={`mt-6 max-w-2xl text-xl leading-relaxed ${centered ? "mx-auto" : ""}`}>{section.subheading}</p> : null}
          <div className="mt-6"><TextLink ctx={ctx} label={section.ctaLabel} path={section.ctaPath} /></div>
        </div>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mt-10 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
      </div>
    );
  }
  if (variant === "offset" && media) {
    return (
      <div className="md:grid md:grid-cols-12 md:items-end">
        <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 66vw, 100vw" className="aspect-[16/10] w-full rounded-(--radius) object-cover md:col-span-8 md:col-start-5 md:row-start-1" loading="eager" fetchPriority="high" />
        <div className="relative mx-4 -mt-12 border border-(--section-border) bg-(--section-bg) p-6 md:col-span-6 md:col-start-1 md:row-start-1 md:mx-0 md:mb-10 md:p-8">{text(true)}</div>
      </div>
    );
  }
  if (variant === "collage" && media) {
    return (
      <div>
        <div className={`max-w-3xl ${centered ? "mx-auto text-center" : ""}`}>{text(true)}</div>
        <HeroCollage ctx={ctx} main={media} extras={heroExtras(ctx, section)} className="mt-8" />
      </div>
    );
  }
  if (variant === "full") {
    return (
      <div className="relative overflow-hidden rounded-(--radius) bg-(--brand-text) text-(--brand-on-text)" style={{ "--section-heading": "var(--brand-on-text)", "--section-accent": "var(--brand-on-text)", "--section-fg": "var(--brand-on-text)", "--section-bg": "var(--brand-text)" } as React.CSSProperties}>
        {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="absolute inset-0 h-full w-full object-cover" loading="eager" fetchPriority="high" /> : null}
        <div className={`relative flex min-h-[24rem] flex-col justify-end px-6 py-12 md:px-12 ${media ? overlayClass[section.overlay] : ""}`}>
          <div className={`max-w-3xl border-l-2 border-(--brand-on-text) pl-6 ${centered ? "mx-auto border-l-0 pl-0 text-center" : ""}`}>{text(true)}</div>
        </div>
      </div>
    );
  }
  if (variant === "split") {
    if (!media) return <div className="max-w-3xl border-b border-(--section-border) pb-10">{text(true)}</div>;
    return (
      <div className="grid items-center gap-8 md:grid-cols-[5fr_6fr]">
        <div>{text(true)}</div>
        <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 55vw, 100vw" className="aspect-[4/3] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" />
      </div>
    );
  }
  // stacked (the theme default): the picture across the width, a hairline, then the words in two columns of reference type.
  return (
    <div>
      {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 1408px) 1408px, 100vw" className="mb-6 aspect-[21/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
      <div className={`border-t border-(--section-border) pt-6 ${centered ? "text-center" : "md:grid md:grid-cols-[2fr_3fr] md:gap-10"}`}>
        <h1 className="font-(family-name:--font-heading) text-4xl font-bold leading-[1.05] tracking-tight text-(--section-heading) sm:text-5xl">{section.heading}</h1>
        <div>
          {section.subheading ? <p className={`mt-4 max-w-prose text-lg leading-relaxed md:mt-1 ${centered ? "mx-auto" : ""}`}>{section.subheading}</p> : null}
          <div className="mt-5"><TextLink ctx={ctx} label={section.ctaLabel} path={section.ctaPath} /></div>
        </div>
      </div>
    </div>
  );
}

function AlmanacSection({ ctx, section, first }: { ctx: RenderContext; section: PageSection; first: boolean }) {
  const onBand = isColouredBand(section.appearance.background);
  switch (section.type) {
    case "image_hero":
      return <ImageHero ctx={ctx} section={section} />;
    case "text_hero": {
      const statement = section.variant === "statement";
      const compact = section.variant === "compact";
      const start = section.appearance.align === "start";
      return (
        <div className={`${compact ? "pb-4" : statement ? "py-6" : "border-b border-(--section-border) pb-10"} ${start ? "" : "text-center"}`}>
          <h1 className={`font-(family-name:--font-heading) font-bold leading-[1.05] tracking-tight text-(--section-heading) ${statement ? "text-6xl sm:text-8xl" : compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl"}`}>{section.heading}</h1>
          {section.subheading ? <p className={`mt-4 max-w-2xl text-lg leading-relaxed ${start ? "" : "mx-auto"}`}>{section.subheading}</p> : null}
          <div className="mt-6"><TextLink ctx={ctx} label={section.ctaLabel} path={section.ctaPath} /></div>
        </div>
      );
    }
    case "rich_text":
      return (
        <>
          {section.heading ? (first ? <h1 className={`mb-6 ${almH1}`}>{section.heading}</h1> : <AlmanacHeading>{section.heading}</AlmanacHeading>) : null}
          {section.body.length ? (
            <RichText ctx={ctx} blocks={section.body as Block[]} className={`alm-prose ${section.variant === "columns" ? "md:columns-2 md:gap-10" : ""} ${section.variant === "lead" ? "[&>p:first-child]:font-(family-name:--font-heading) [&>p:first-child]:text-xl [&>p:first-child]:leading-relaxed" : ""}`} />
          ) : null}
        </>
      );
    case "feature_list": {
      const variant = section.variant === "default" ? "grid" : section.variant;
      const columns = columnsFor("almanac", "feature_list", section.columns);
      const item = (it: (typeof section.items)[number], i: number) => (
        <>
          <p className="text-xs tabular-nums text-(--section-accent)">{String(i + 1).padStart(2, "0")}</p>
          {it.path ? (
            <a {...linkProps(ctx, it.path)} className="mt-1 block font-(family-name:--font-heading) text-lg font-bold tracking-tight text-(--section-heading) hover:underline">{it.title}</a>
          ) : (
            <p className="mt-1 font-(family-name:--font-heading) text-lg font-bold tracking-tight">{it.title}</p>
          )}
          {it.text ? <p className="mt-1 text-sm text-(--section-muted)">{it.text}</p> : null}
        </>
      );
      return (
        <>
          {section.heading ? <AlmanacHeading>{section.heading}</AlmanacHeading> : null}
          {section.items.length === 0 ? null : variant === "list" ? (
            <ol className="divide-y divide-(--section-border) border-b border-(--section-border)">
              {section.items.map((it, i) => <li key={it.title} className="py-3">{item(it, i)}</li>)}
            </ol>
          ) : variant === "cards" ? (
            <ol className={`grid gap-4 ${columnsClass[columns]}`}>
              {section.items.map((it, i) => <li key={it.title} className={`${almanacStyle.panel} p-4`}>{item(it, i)}</li>)}
            </ol>
          ) : (
            <ol className={`grid gap-x-8 gap-y-6 ${columnsClass[columns]}`}>
              {section.items.map((it, i) => <li key={it.title} className="border-t border-(--section-border) pt-3">{item(it, i)}</li>)}
            </ol>
          )}
        </>
      );
    }
    case "content_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <>
          {section.heading ? <AlmanacHeading>{section.heading}</AlmanacHeading> : null}
          <AlmanacCollection ctx={ctx} kind={section.kind} items={items} variant={section.variant} columns={columnsFor("almanac", "content_collection", section.columns)} />
        </>
      );
    }
    case "location_collection": {
      const items = resolveCollection(ctx, section);
      return (
        <>
          {section.heading ? <AlmanacHeading>{section.heading}</AlmanacHeading> : null}
          <AlmanacCollection ctx={ctx} kind="store" items={items} variant={section.variant} columns={columnsFor("almanac", "location_collection", section.columns)} />
        </>
      );
    }
    case "category_list": {
      const categories = resolveCategories(ctx, section);
      if (categories.length === 0) return null;
      const variant = section.variant === "default" ? "list" : section.variant;
      const count = (n: number) => (section.showCounts ? <span className="tabular-nums text-(--section-muted)">{n}</span> : null);
      const link = "font-(family-name:--font-heading) text-lg font-bold tracking-tight text-(--section-heading) hover:underline";
      return (
        <>
          {section.heading ? <AlmanacHeading>{section.heading}</AlmanacHeading> : null}
          {variant === "chips" ? (
            <ul className="flex flex-wrap gap-2 text-sm">
              {categories.map((c) => (
                <li key={c.name}><a href={href(ctx, c.path)} className="inline-block rounded-(--radius) border border-(--brand-border-strong) px-3 py-1 font-semibold uppercase tracking-[0.12em] hover:border-(--section-heading) hover:text-(--section-heading)">{c.name}{section.showCounts ? <span className="ml-2 tabular-nums text-(--section-muted)">{c.count}</span> : null}</a></li>
              ))}
            </ul>
          ) : variant === "grid" ? (
            <ul className={`grid gap-x-8 ${columnsClass[columnsFor("almanac", "category_list", section.columns)]}`}>
              {categories.map((c) => <li key={c.name} className="flex items-baseline justify-between gap-4 border-t border-(--section-border) py-3"><a href={href(ctx, c.path)} className={link}>{c.name}</a>{count(c.count)}</li>)}
            </ul>
          ) : (
            <ul className="divide-y divide-(--section-border) border-y border-(--section-border) md:columns-2 md:gap-10 md:border-y-0">
              {categories.map((c) => <li key={c.name} className="flex items-baseline justify-between gap-4 py-2.5 md:border-b md:border-(--section-border)"><a href={href(ctx, c.path)} className={link}>{c.name}</a>{count(c.count)}</li>)}
            </ul>
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
      const boxed = section.appearance.background === "default" ? "border border-(--section-border) bg-(--section-panel) text-(--section-panel-fg)" : "";
      if (section.variant === "banner") {
        return (
          <div className={`rounded-(--radius) px-6 py-8 text-center ${boxed}`}>
            <p className={almEyebrow}>Get in touch</p>
            <h2 className="mt-2 font-(family-name:--font-heading) text-3xl font-bold tracking-tight text-(--section-heading)">{section.heading}</h2>
            {section.text ? <p className="mx-auto mt-2 max-w-prose">{section.text}</p> : null}
            {details}
            <p className="mt-5"><a href={href(ctx, "/contact")} className={onBand ? almanacStyle.buttonInverse : almanacStyle.buttonPrimary}>Contact page</a></p>
          </div>
        );
      }
      const split = section.variant === "split";
      return (
        <div className={`rounded-(--radius) px-6 py-6 ${boxed} ${split ? "grid gap-6 md:grid-cols-[3fr_2fr] md:items-center" : ""}`}>
          <div>
            <p className={almEyebrow}>Get in touch</p>
            <h2 className="mt-1 font-(family-name:--font-heading) text-2xl font-bold tracking-tight text-(--section-heading)">{section.heading}</h2>
            {section.text ? <p className="mt-2 max-w-prose">{section.text}</p> : null}
            {details}
          </div>
          <p className={split ? "md:justify-self-end" : "mt-4"}><a href={href(ctx, "/contact")} className={onBand ? almanacStyle.buttonInverse : almanacStyle.buttonPrimary}>Contact page</a></p>
        </div>
      );
    }
    case "inquiry_form": {
      const locations = section.locationSelect ? Object.values(ctx.snapshot.items).filter((i) => i.kind === "place" || i.kind === "store").map((i) => ({ id: i.id, label: i.title })) : [];
      return (
        <div className={section.variant === "wide" ? "" : "max-w-2xl"}>
          <InquiryForm endpoint={ctx.inquiryEndpoint} heading={section.heading} intro={section.intro} sourcePath={ctx.path} locations={locations} styles={almFormStyles} />
        </div>
      );
    }
    case "faq":
      return <FaqSection ctx={ctx} section={section} style={almanacStyle} />;
    case "quotes":
      return <QuotesSection ctx={ctx} section={section} style={almanacStyle} />;
    case "cta_banner":
      return <CtaBannerSection ctx={ctx} section={section} style={almanacBannerStyle} />;
    case "gallery":
      return <GallerySection ctx={ctx} section={section} style={almanacStyle} />;
    case "facts":
      return <FactsSection section={section} style={almanacStyle} />;
    case "video":
      return <VideoSection ctx={ctx} section={section} style={almanacStyle} />;
    case "map_link":
      return <MapLinkSection ctx={ctx} section={section} style={almanacStyle} />;
    case "team":
      return <TeamSection ctx={ctx} section={section} style={almanacStyle} />;
    case "logo_strip":
      return <LogoStripSection ctx={ctx} section={section} style={almanacStyle} />;
    case "image_text":
      return <ImageTextSection ctx={ctx} section={section} style={almanacStyle} />;
    case "image_band":
      // Rendered by AlmanacSections outside the section frame.
      return null;
  }
}

type CollectionVariant = "cards" | "list" | "text" | "featured";

function resolveCollectionVariant(ctx: RenderContext, kind: string, variant: string): CollectionVariant {
  if (variant !== "default") return variant as CollectionVariant;
  if (kind === "article" || kind === "event") return "list";
  const cards = siteDesign(ctx).cards;
  return cards === "image-top" ? "cards" : cards === "text" ? "text" : "list";
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

/** Collections in the almanac: reference rows with square thumbnails by default, a numbered text index, framed cards, or a lead entry followed by the index. */
export function AlmanacCollection({ ctx, kind, items, variant = "default", columns = 2 }: { ctx: RenderContext; kind: string; items: SnapshotItem[]; variant?: string; columns?: 2 | 3 | 4 }) {
  // An empty collection renders nothing; the section is left out of the page before this point (B2, D-021).
  if (items.length === 0) return null;
  const v = resolveCollectionVariant(ctx, kind, variant);
  const kicker = (it: SnapshotItem): string => {
    if (kind === "event") {
      const d = eventDate(it);
      return `${d.mon} ${d.day}${it.payload.status === "cancelled" ? " · Cancelled" : ""}`;
    }
    if (kind === "article") return `${formatDateOnly(String(it.payload.publishedOn))} · ${String(it.payload.authorName)}`;
    const parts = [it.payload.category ? String(it.payload.category) : "", it.payload.lastVerifiedOn ? `Verified ${formatDateOnly(String(it.payload.lastVerifiedOn))}` : ""].filter(Boolean);
    return parts.join(" · ");
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
            <li key={ev.id} className="grid gap-4 py-4 sm:grid-cols-[4.5rem_1fr]">
              <div className="border-l-2 border-(--section-accent) pl-3">
                <p className={almEyebrow}>{d.mon}</p>
                <p className="font-(family-name:--font-heading) text-3xl font-bold leading-none tabular-nums">{d.day}</p>
              </div>
              <div className="min-w-0">
                <p className="font-(family-name:--font-heading) text-xl font-bold tracking-tight">
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
      <div>
        <article className="grid gap-6 border-b border-(--section-border) pb-8 md:grid-cols-[2fr_3fr] md:gap-10">
          {leadImg ? <Picture ctx={ctx} media={leadImg} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/3] w-full rounded-(--radius) object-cover" /> : null}
          <div className={leadImg ? "" : "md:col-span-2"}>
            {kicker(lead) ? <p className={almEyebrow}>{kicker(lead)}</p> : null}
            {titleLink(lead, "mt-1 font-(family-name:--font-heading) text-3xl font-bold leading-tight tracking-tight")}
            {lead.payload.summary ? <p className="mt-3 text-lg">{String(lead.payload.summary)}</p> : null}
            {meta(lead) ? <p className="mt-2 text-sm text-(--section-muted)">{meta(lead)}</p> : null}
          </div>
        </article>
        {rest.length ? <TextIndex ctx={ctx} items={rest} kicker={kicker} columns={columns} start={2} /> : null}
      </div>
    );
  }
  if (v === "text") return <TextIndex ctx={ctx} items={items} kicker={kicker} columns={columns} />;
  if (v === "cards") {
    return (
      <ul className={`grid gap-5 ${columnsClass[columns]}`}>
        {items.map((it) => {
          const img = featuredImage(ctx, it);
          return (
            <li key={it.id} className={`${almanacStyle.panel} p-3`}>
              {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="mb-3 aspect-[4/3] w-full rounded-(--radius) object-cover" /> : null}
              {kicker(it) ? <p className={almEyebrow}>{kicker(it)}</p> : null}
              {titleLink(it, "mt-1 font-(family-name:--font-heading) text-xl font-bold tracking-tight")}
              {meta(it) ? <p className="text-sm text-(--section-muted)">{meta(it)}</p> : null}
              {it.payload.summary ? <p className="mt-1 text-sm text-(--section-muted)">{String(it.payload.summary)}</p> : null}
            </li>
          );
        })}
      </ul>
    );
  }
  // list (the theme default): reference rows with a square thumbnail.
  return (
    <ol className="divide-y divide-(--section-border) border-y border-(--section-border)">
      {items.map((it) => {
        const img = featuredImage(ctx, it);
        return (
          <li key={it.id} className="flex gap-5 py-4">
            {img ? <Picture ctx={ctx} media={img} sizes="112px" className="aspect-square w-20 shrink-0 rounded-(--radius) object-cover sm:w-28" /> : null}
            <div className="min-w-0">
              {kicker(it) ? <p className={almEyebrow}>{kicker(it)}</p> : null}
              {titleLink(it, "mt-0.5 font-(family-name:--font-heading) text-xl font-bold tracking-tight")}
              {meta(it) ? <p className="text-sm text-(--section-muted)">{meta(it)}</p> : null}
              {it.payload.summary ? <p className="mt-1 text-sm">{String(it.payload.summary)}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Numbered index of entries in columns, with kicker and summary. */
function TextIndex({ ctx, items, kicker, columns, start = 1 }: { ctx: RenderContext; items: SnapshotItem[]; kicker: (it: SnapshotItem) => string; columns: 2 | 3 | 4; start?: number }) {
  return (
    <ol className={`grid gap-x-8 gap-y-4 ${columnsClass[columns]}`} start={start}>
      {items.map((it, i) => {
        const p = itemPath(ctx, it);
        return (
          <li key={it.id} className="grid grid-cols-[2.25rem_1fr] border-t border-(--section-border) pt-3">
            <p className="text-xs tabular-nums text-(--section-accent)">{String(start + i).padStart(2, "0")}</p>
            <div>
              {kicker(it) ? <p className={almEyebrow}>{kicker(it)}</p> : null}
              <h3 className="font-(family-name:--font-heading) text-lg font-bold tracking-tight">{p ? <a href={href(ctx, p)} className="hover:underline">{it.title}</a> : it.title}</h3>
              {it.payload.summary ? <p className="mt-1 text-sm text-(--section-muted)">{String(it.payload.summary)}</p> : null}
            </div>
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
  return (
    <article className="max-w-3xl">
      <h1 className={almH1}>{item.title}</h1>
      {item.payload.summary ? <p className="mt-3 text-lg">{String(item.payload.summary)}</p> : null}
      <RichText ctx={ctx} blocks={(item.payload.body as Block[]) ?? []} className="alm-prose mt-6" />
    </article>
  );
}

export const almanacTheme: Theme = {
  key: "almanac",
  render(ctx, route: ResolvedRoute) {
    switch (route.type) {
      case "page": {
        const page = route.item.payload as unknown as PagePayload;
        const header = pageHeaderImage(ctx, route.item);
        return (
          <AlmanacLayout ctx={ctx}>
            {header ? <HeaderImage ctx={ctx} media={header} /> : null}
            <AlmanacSections ctx={ctx} page={page} />
          </AlmanacLayout>
        );
      }
      case "detail":
        return (
          <AlmanacLayout ctx={ctx}>
            <PageContainer>
              {route.kind === "place" ? <AlmanacPlaceDetail ctx={ctx} item={route.item} /> : route.kind === "event" ? <AlmanacEventDetail ctx={ctx} item={route.item} /> : route.kind === "article" ? <AlmanacArticleDetail ctx={ctx} item={route.item} /> : <GenericDetail ctx={ctx} item={route.item} />}
            </PageContainer>
          </AlmanacLayout>
        );
      case "index":
        return (
          <AlmanacLayout ctx={ctx}>
            <PageContainer><AlmanacIndex ctx={ctx} kind={route.kind} /></PageContainer>
          </AlmanacLayout>
        );
      case "search":
        return (
          <AlmanacLayout ctx={ctx}>
            <PageContainer><AlmanacSearch ctx={ctx} /></PageContainer>
          </AlmanacLayout>
        );
      default:
        return null;
    }
  },
};

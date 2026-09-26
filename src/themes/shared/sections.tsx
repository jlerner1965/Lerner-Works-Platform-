import type { ReactNode } from "react";
import type { PageSection } from "@/modules/page";
import type { RenderContext } from "@/themes/shared/types";
import type { Block } from "@/lib/richtext";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { linkProps } from "@/themes/shared/site-root";
import { isColouredBand, columnsFor } from "@/themes/shared/design";
import type { ThemeKey } from "@/themes/capabilities";
import { VideoEmbed, type VideoPoster } from "@/themes/shared/video";

type Of<T extends PageSection["type"]> = Extract<PageSection, { type: T }>;

/**
 * Theme-specific classes for the section types both themes share (design programme D1).
 * Every class refers to `--section-*` or `--brand-*` variables so the same component works
 * on the page background and inside coloured bands.
 */
export interface SectionStyle {
  /** The theme these classes belong to (its default column counts apply when a section sets none). */
  theme: ThemeKey;
  /** Section heading element in the theme's style (h2). */
  heading: (text: string) => ReactNode;
  intro: string;
  eyebrow: string;
  title: string;
  prose: string;
  /** Filled button on the page background; on coloured bands `buttonInverse` is used instead. */
  buttonPrimary: string;
  buttonInverse: string;
  buttonOutline: string;
  /** Bordered panel inside a section. */
  panel: string;
  quote: string;
  fact: string;
}

export const columnsClass: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function Buttons({ ctx, section, style }: { ctx: RenderContext; section: { ctaLabel: string; ctaPath: string; secondaryLabel?: string; secondaryPath?: string; appearance: { background: string; align: string } }; style: SectionStyle }) {
  const onBand = isColouredBand(section.appearance.background as never);
  const primary = section.ctaLabel && section.ctaPath ? <a {...linkProps(ctx, section.ctaPath)} className={onBand ? style.buttonInverse : style.buttonPrimary}>{section.ctaLabel}</a> : null;
  const secondary = section.secondaryLabel && section.secondaryPath ? <a {...linkProps(ctx, section.secondaryPath)} className={style.buttonOutline}>{section.secondaryLabel}</a> : null;
  if (!primary && !secondary) return null;
  return (
    <div className={`mt-6 flex flex-wrap gap-3 ${section.appearance.align === "center" ? "justify-center" : ""}`}>
      {primary}
      {secondary}
    </div>
  );
}

export function FaqSection({ ctx, section, style }: { ctx: RenderContext; section: Of<"faq">; style: SectionStyle }) {
  const open = section.variant === "open";
  return (
    <>
      {section.heading ? style.heading(section.heading) : null}
      {section.items.length === 0 ? (
        <p className="text-(--section-muted)">No questions have been added yet.</p>
      ) : open ? (
        <dl className="divide-y divide-(--section-border) border-y border-(--section-border)">
          {section.items.map((item, i) => (
            <div key={i} className="py-4">
              <dt className={style.title}>{item.question}</dt>
              <dd className="mt-2"><RichText ctx={ctx} blocks={item.answer as Block[]} className={style.prose} /></dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="divide-y divide-(--section-border) border-y border-(--section-border)">
          {section.items.map((item, i) => (
            <details key={i} className="group py-3">
              <summary className={`flex cursor-pointer list-none items-start justify-between gap-4 rounded-(--radius) ${style.title} [&::-webkit-details-marker]:hidden`}>
                <span>{item.question}</span>
                <span aria-hidden="true" className="mt-0.5 shrink-0 text-(--section-accent) transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="pt-3 pb-1"><RichText ctx={ctx} blocks={item.answer as Block[]} className={style.prose} /></div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}

export function QuotesSection({ section, style }: { section: Of<"quotes">; style: SectionStyle }) {
  const items = section.items;
  const single = section.variant === "single" || (section.variant === "default" && items.length <= 1);
  const quote = (item: Of<"quotes">["items"][number], large: boolean) => (
    <figure className={large ? "mx-auto max-w-3xl" : ""}>
      <blockquote className={`${style.quote} ${large ? "text-2xl sm:text-3xl" : "text-lg"}`}>“{item.text}”</blockquote>
      <figcaption className="mt-3 text-sm text-(--section-muted)">
        <span className="font-semibold text-(--section-fg)">{item.attribution}</span>
        {item.role ? `, ${item.role}` : ""}
      </figcaption>
    </figure>
  );
  return (
    <>
      {section.heading ? style.heading(section.heading) : null}
      {items.length === 0 ? (
        <p className="text-(--section-muted)">No quotations have been added yet.</p>
      ) : single ? (
        <div className="space-y-10">{items.map((item, i) => <div key={i}>{quote(item, true)}</div>)}</div>
      ) : (
        <ul className={`grid gap-8 ${columnsClass[items.length >= 3 ? 3 : 2]}`}>
          {items.map((item, i) => <li key={i}>{quote(item, false)}</li>)}
        </ul>
      )}
    </>
  );
}

export function CtaBannerSection({ ctx, section, style }: { ctx: RenderContext; section: Of<"cta_banner">; style: SectionStyle }) {
  const split = section.variant === "split";
  const centered = !split && (section.variant === "centered" || section.appearance.align === "center" || section.variant === "default");
  return (
    <div className={split ? "grid gap-6 md:grid-cols-[3fr_2fr] md:items-center" : centered ? "mx-auto max-w-3xl text-center" : ""}>
      <div>
        {style.heading(section.heading)}
        {section.text ? <p className={style.intro}>{section.text}</p> : null}
      </div>
      <div className={split ? "md:justify-self-end" : ""}>
        <Buttons ctx={ctx} section={{ ...section, appearance: { ...section.appearance, align: centered ? "center" : section.appearance.align } }} style={style} />
      </div>
    </div>
  );
}

const aspectClass: Record<Of<"gallery">["aspect"], string> = { landscape: "aspect-[4/3]", square: "aspect-square", portrait: "aspect-[3/4]", natural: "" };

export function GallerySection({ ctx, section, style }: { ctx: RenderContext; section: Of<"gallery">; style: SectionStyle }) {
  const items = section.items.map((it) => ({ ...it, media: ctx.snapshot.media[it.assetId] })).filter((it) => it.media && Object.keys(it.media.variants).length > 0);
  const variant = section.variant === "default" ? "grid" : section.variant;
  const columns = columnsFor(style.theme, "gallery", section.columns);
  const sizes = `(min-width: 1024px) ${Math.round(100 / columns)}vw, (min-width: 640px) 50vw, 100vw`;
  const figure = (it: (typeof items)[number], extra = "") => (
    <figure key={it.assetId} className={`${extra} break-inside-avoid`}>
      <Picture ctx={ctx} media={it.media!} sizes={sizes} className={`w-full rounded-(--radius) ${variant === "columns" ? "" : aspectClass[section.aspect]} ${section.aspect === "natural" || variant === "columns" ? "h-auto" : "object-cover"}`} />
      {it.caption ? <figcaption className="mt-1.5 text-sm text-(--section-muted)">{it.caption}</figcaption> : null}
    </figure>
  );
  return (
    <>
      {section.heading ? style.heading(section.heading) : null}
      {items.length === 0 ? (
        <p className="text-(--section-muted)">No images have been added yet.</p>
      ) : variant === "columns" ? (
        <div className={`gap-4 space-y-4 ${columns === 2 ? "sm:columns-2" : columns === 3 ? "sm:columns-2 lg:columns-3" : "sm:columns-2 lg:columns-4"}`}>{items.map((it) => figure(it))}</div>
      ) : variant === "strip" ? (
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">{items.map((it) => figure(it, "w-72 shrink-0 snap-start"))}</div>
      ) : (
        <div className={`grid gap-4 ${columnsClass[columns]}`}>{items.map((it) => figure(it))}</div>
      )}
    </>
  );
}

export function FactsSection({ section, style }: { section: Of<"facts">; style: SectionStyle }) {
  const variant = section.variant === "default" ? "grid" : section.variant;
  return (
    <>
      {section.heading ? style.heading(section.heading) : null}
      {section.items.length === 0 ? (
        <p className="text-(--section-muted)">No facts have been added yet.</p>
      ) : variant === "list" ? (
        <dl className="divide-y divide-(--section-border) border-y border-(--section-border)">
          {section.items.map((f, i) => (
            <div key={i} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_2fr] sm:gap-6">
              <dt className={style.eyebrow}>{f.label}</dt>
              <dd className="text-lg">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : variant === "inline" ? (
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {section.items.map((f, i) => (
            <div key={i}>
              <dt className={style.eyebrow}>{f.label}</dt>
              <dd className={style.fact}>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <dl className={`grid gap-6 ${columnsClass[columnsFor(style.theme, "facts", section.columns)]}`}>
          {section.items.map((f, i) => (
            <div key={i} className={`${style.panel} p-4`}>
              <dt className={style.eyebrow}>{f.label}</dt>
              <dd className={style.fact}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

export function VideoSection({ ctx, section, style }: { ctx: RenderContext; section: Of<"video">; style: SectionStyle }) {
  const media = section.posterAssetId ? ctx.snapshot.media[section.posterAssetId] : undefined;
  let poster: VideoPoster | null = null;
  if (media) {
    const variants = (["w480", "w960", "w1600"] as const).map((k) => ({ k, v: media.variants[k] })).filter((x) => x.v);
    const largest = variants[variants.length - 1];
    if (largest) {
      poster = {
        src: ctx.assetUrl(media, largest.k),
        srcSet: variants.map((x) => `${ctx.assetUrl(media, x.k)} ${x.v!.width}w`).join(", "),
        sizes: "(min-width: 1152px) 1152px, 100vw",
        width: largest.v!.width,
        height: largest.v!.height,
        alt: media.decorative ? "" : media.alt,
        ...(media.focal ? { objectPosition: `${Math.round(media.focal.x * 100)}% ${Math.round(media.focal.y * 100)}%` } : {}),
      };
    }
  }
  const title = section.title || section.heading || "Video";
  return (
    <>
      {section.heading ? style.heading(section.heading) : null}
      {section.videoId ? (
        <VideoEmbed provider={section.provider} videoId={section.videoId} title={title} poster={poster} caption={section.caption} buttonClass={style.buttonPrimary} frameClass="rounded-(--radius) bg-(--brand-text)" />
      ) : (
        <p className="text-(--section-muted)">No video has been chosen yet.</p>
      )}
    </>
  );
}

const mapUrl: Record<Of<"map_link">["provider"], (q: string) => string> = {
  google: (q) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`,
  apple: (q) => `https://maps.apple.com/?daddr=${encodeURIComponent(q)}`,
  openstreetmap: (q) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`,
};

export function MapLinkSection({ ctx, section, style }: { ctx: RenderContext; section: Of<"map_link">; style: SectionStyle }) {
  const a = section.address;
  const line1 = [a.line1, a.line2].filter(Boolean).join(", ");
  const line2 = [a.locality, a.region, a.postalCode].filter(Boolean).join(" ");
  const query = [line1, line2].filter(Boolean).join(", ");
  const canLink = ctx.mode === "live" && a.approved && query.length > 0;
  const onBand = isColouredBand(section.appearance.background);
  const body = (
    <>
      {section.heading ? style.heading(section.heading) : null}
      {section.text ? <p className={style.intro}>{section.text}</p> : null}
      {query ? <p className="mt-3 text-lg">{line1}{line1 && line2 ? <br /> : null}{line2}</p> : <p className="text-(--section-muted)">No address has been entered yet.</p>}
      {canLink ? (
        <p className="mt-4"><a href={mapUrl[section.provider](query)} rel="noreferrer" className={onBand ? style.buttonInverse : style.buttonPrimary}>{section.label || "Get directions"}</a></p>
      ) : query ? (
        <p className="mt-4 text-sm text-(--section-muted)">
          <span className="inline-block border border-(--section-border) px-3 py-1" aria-disabled="true">{section.label || "Get directions"}</span>{" "}
          {ctx.mode !== "live" ? "Directions are disabled on demonstration sites." : "Directions appear once the owner approves this address."}
        </p>
      ) : null}
    </>
  );
  return section.variant === "card" ? <div className={`${style.panel} p-6`}>{body}</div> : body;
}

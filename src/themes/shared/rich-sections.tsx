import type { CSSProperties } from "react";
import type { PageSection } from "@/modules/page";
import type { RenderContext } from "@/themes/shared/types";
import type { SnapshotMedia } from "@/server/publishing/snapshot";
import type { Block } from "@/lib/richtext";
import { RichText } from "@/themes/shared/richtext";
import { Picture } from "@/themes/shared/picture";
import { linkProps } from "@/themes/shared/site-root";
import { bandVariables, columnsFor } from "@/themes/shared/design";
import { Buttons, columnsClass, type SectionStyle } from "@/themes/shared/sections";

type Of<T extends PageSection["type"]> = Extract<PageSection, { type: T }>;

/**
 * Section renderers added by the site-building programme's phase B3, shared by every
 * composition through `SectionStyle`: people, a logo strip, image-and-text rows, the photo
 * band and the hero collage. Every colour is a section or brand variable; every layout choice
 * is an enumerated variant or an appearance value (decision D-017).
 */

const cardSizes = (columns: 2 | 3 | 4) => `(min-width: 1024px) ${Math.round(100 / columns)}vw, (min-width: 640px) 50vw, 100vw`;

export function TeamSection({ ctx, section, style }: { ctx: RenderContext; section: Of<"team">; style: SectionStyle }) {
  const variant = section.variant === "default" ? "grid" : section.variant;
  const columns = columnsFor(style.theme, "team", section.columns);
  const portrait = (assetId: string | null | undefined, shape: "square" | "round", sizes: string, className: string) => {
    const media = assetId ? ctx.snapshot.media[assetId] : undefined;
    if (!media || Object.keys(media.variants).length === 0) return null;
    return <Picture ctx={ctx} media={media} sizes={sizes} className={`${shape === "round" ? "rounded-full" : "rounded-(--radius)"} object-cover ${className}`} />;
  };
  const name = (it: Of<"team">["items"][number]) => (it.path ? <a {...linkProps(ctx, it.path)} className="hover:underline">{it.name}</a> : it.name);
  return (
    <>
      {section.heading ? style.heading(section.heading) : null}
      {section.intro ? <p className={`${style.intro} mb-8`}>{section.intro}</p> : null}
      {section.items.length === 0 ? null : variant === "list" ? (
        <ul className="divide-y divide-(--section-border) border-y border-(--section-border)">
          {section.items.map((it, i) => (
            <li key={i} className="flex gap-5 py-5">
              {portrait(it.assetId, "square", "160px", "aspect-square w-24 shrink-0 sm:w-32")}
              <div className="min-w-0">
                <h3 className={style.title}>{name(it)}</h3>
                {it.role ? <p className={`mt-0.5 ${style.eyebrow}`}>{it.role}</p> : null}
                {it.text ? <p className="mt-2 max-w-prose">{it.text}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : variant === "compact" ? (
        <ul className="flex flex-wrap gap-x-8 gap-y-5">
          {section.items.map((it, i) => (
            <li key={i} className="flex items-center gap-3">
              {portrait(it.assetId, "round", "96px", "h-12 w-12 shrink-0")}
              <div>
                <p className={style.title}>{name(it)}</p>
                {it.role ? <p className="text-sm text-(--section-muted)">{it.role}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={`grid gap-8 ${columnsClass[columns]}`}>
          {section.items.map((it, i) => (
            <li key={i}>
              {portrait(it.assetId, "square", cardSizes(columns), "mb-4 aspect-square w-full")}
              <h3 className={style.title}>{name(it)}</h3>
              {it.role ? <p className={`mt-0.5 ${style.eyebrow}`}>{it.role}</p> : null}
              {it.text ? <p className="mt-2 text-sm text-(--section-muted)">{it.text}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function LogoStripSection({ ctx, section, style }: { ctx: RenderContext; section: Of<"logo_strip">; style: SectionStyle }) {
  const items = section.items.map((it) => ({ ...it, media: ctx.snapshot.media[it.assetId] })).filter((it) => it.media && Object.keys(it.media.variants).length > 0);
  if (items.length === 0) return null;
  const variant = section.variant === "default" ? "row" : section.variant;
  const columns = columnsFor(style.theme, "logo_strip", section.columns);
  const cell = (it: (typeof items)[number]) => {
    const img = <Picture ctx={ctx} media={it.media!} sizes="200px" focal={false} className={`h-10 w-auto max-w-40 object-contain sm:h-12 ${variant === "mono" ? "grayscale" : ""}`} />;
    const label = it.label ? <span className="text-xs font-semibold text-(--section-muted)">{it.label}</span> : null;
    return it.path ? (
      <a {...linkProps(ctx, it.path)} className="inline-flex flex-col items-center gap-2 hover:opacity-80">{img}{label}</a>
    ) : (
      <span className="inline-flex flex-col items-center gap-2">{img}{label}</span>
    );
  };
  return (
    <>
      {section.heading ? <p className={`mb-6 text-center ${style.eyebrow}`}>{section.heading}</p> : null}
      {variant === "grid" ? (
        <ul className={`grid gap-px overflow-hidden rounded-(--radius) bg-(--section-border) ${columnsClass[columns]}`}>
          {items.map((it, i) => <li key={i} className="flex items-center justify-center bg-(--section-bg) p-6">{cell(it)}</li>)}
        </ul>
      ) : (
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {items.map((it, i) => <li key={i}>{cell(it)}</li>)}
        </ul>
      )}
    </>
  );
}

export function ImageTextSection({ ctx, section, style }: { ctx: RenderContext; section: Of<"image_text">; style: SectionStyle }) {
  const variant = section.variant === "default" ? "alternating" : section.variant;
  return (
    <>
      {section.heading ? style.heading(section.heading) : null}
      <div className="space-y-12 md:space-y-16">
        {section.items.map((it, i) => {
          const media = ctx.snapshot.media[it.assetId];
          const imageFirst = variant === "image_left" || (variant === "alternating" && i % 2 === 0);
          return (
            <div key={i} className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
              {media ? <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 50vw, 100vw" className={`aspect-[4/3] w-full rounded-(--radius) object-cover ${imageFirst ? "" : "md:order-2"}`} /> : null}
              <div className={media ? "" : "md:col-span-2"}>
                <h3 className={style.subtitle}>{it.heading}</h3>
                {it.body.length ? <RichText ctx={ctx} blocks={it.body as Block[]} className={`${style.prose} mt-4`} /> : null}
                <Buttons ctx={ctx} section={{ ctaLabel: it.ctaLabel, ctaPath: it.ctaPath, appearance: { ...section.appearance, align: "start" } }} style={style} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const washClass: Record<Of<"image_band">["tint"], Record<Of<"image_band">["strength"], string>> = {
  primary: { light: "lw-wash-primary-light", medium: "lw-wash-primary-medium", strong: "lw-wash-primary-strong" },
  accent: { light: "lw-wash-accent-light", medium: "lw-wash-accent-medium", strong: "lw-wash-accent-strong" },
  dark: { light: "lw-wash-dark-light", medium: "lw-wash-dark-medium", strong: "lw-wash-dark-strong" },
};

/**
 * Photo band: renders its own full-width `<section>` in place of the section frame. The wash
 * is a brand colour over the picture and the text uses that colour's "on" token, the same
 * pairing the tinted bands use, so the contrast gate already covers it.
 */
export function ImageBandSection({ ctx, section, style }: { ctx: RenderContext; section: Of<"image_band">; style: SectionStyle }) {
  const media = section.imageAssetId ? ctx.snapshot.media[section.imageAssetId] : undefined;
  const hasImage = Boolean(media && Object.keys(media.variants).length > 0);
  const tint = section.tint ?? "dark";
  const strength = section.strength ?? "medium";
  const variant = section.variant === "default" ? "regular" : section.variant;
  const pad = variant === "compact" ? "py-12 sm:py-16" : variant === "tall" ? "py-24 sm:py-40" : "py-16 sm:py-24";
  const center = section.appearance.align === "center";
  return (
    <section className="lw-band relative overflow-hidden bg-(--section-bg) text-(--section-fg)" style={bandVariables(tint) as CSSProperties}>
      {hasImage ? <Picture ctx={ctx} media={media!} sizes="100vw" className="absolute inset-0 h-full w-full object-cover" /> : null}
      <div className={`relative ${hasImage ? washClass[tint][strength] : ""}`}>
        <div className={`mx-auto max-w-(--container) px-4 ${pad} ${center ? "text-center" : ""}`}>
          <div className={`max-w-3xl ${center ? "mx-auto" : ""}`}>
            {section.heading ? <h2 className={style.display}>{section.heading}</h2> : null}
            {section.text ? <p className={`mt-4 text-lg leading-relaxed sm:text-xl ${center ? "mx-auto" : ""} max-w-prose`}>{section.text}</p> : null}
            <Buttons ctx={ctx} section={{ ...section, appearance: { ...section.appearance, background: tint } }} style={style} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Media of a hero's extra pictures, in order, skipping any the release does not carry. */
export function heroExtras(ctx: RenderContext, section: Of<"image_hero">): SnapshotMedia[] {
  return (section.extraImageAssetIds ?? []).map((id) => ctx.snapshot.media[id]).filter((m): m is SnapshotMedia => Boolean(m && Object.keys(m.variants).length > 0));
}

/** The hero picture with up to three more: the main picture leads, the others stack beside it. */
export function HeroCollage({ ctx, main, extras, className = "" }: { ctx: RenderContext; main: SnapshotMedia; extras: SnapshotMedia[]; className?: string }) {
  if (extras.length === 0) return <Picture ctx={ctx} media={main} sizes="(min-width: 1408px) 1408px, 100vw" className={`aspect-[16/9] w-full rounded-(--radius) object-cover ${className}`} loading="eager" fetchPriority="high" />;
  const side = extras.length === 1 ? "grid-cols-1" : extras.length === 2 ? "grid-cols-2 md:grid-cols-1" : "grid-cols-3 md:grid-cols-2";
  return (
    <div className={`grid gap-3 sm:gap-4 md:grid-cols-[3fr_2fr] ${className}`}>
      <Picture ctx={ctx} media={main} sizes="(min-width: 768px) 60vw, 100vw" className="aspect-[4/3] h-full w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" />
      <div className={`grid gap-3 sm:gap-4 ${side}`}>
        {extras.map((m, i) => (
          <Picture
            key={m.id}
            ctx={ctx}
            media={m}
            sizes="(min-width: 768px) 20vw, 33vw"
            className={`w-full rounded-(--radius) object-cover ${extras.length === 1 ? "aspect-[4/3] h-full" : extras.length === 2 ? "aspect-square md:aspect-[4/3]" : i === 0 ? "aspect-square md:col-span-2 md:aspect-[2/1]" : "aspect-square"}`}
          />
        ))}
      </div>
    </div>
  );
}

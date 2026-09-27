import type { ReactNode } from "react";
import type { RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { SnapshotItem, SnapshotMedia } from "@/server/publishing/snapshot";
import type { ContentKind } from "@/modules/registry";
import { kindRegistry } from "@/modules/registry";
import { isExternalLink, type IndexModuleKey } from "@/modules/site-config";
import { typographyPresets } from "@/themes/fonts";
import { Picture } from "@/themes/shared/picture";
import { rootVariables } from "@/themes/shared/design";
import { documentHref } from "@/themes/shared/documents";

/**
 * Root element of every public page: derived brand tokens and design scales as CSS custom
 * properties, the chosen typography preset as `--font-heading` / `--font-body`, and the
 * site's language. Themes use only these variables; no literal colours or font names live
 * in theme code.
 */
export function SiteRoot({ ctx, themeClass, children }: { ctx: RenderContext; themeClass: string; children: ReactNode }) {
  const { branding, metadata } = ctx.snapshot.config;
  const type = typographyPresets[branding.typography] ?? typographyPresets["editorial-serif"];
  const style = {
    ...rootVariables(ctx),
    "--font-heading": `var(${type.headingVariable})`,
    "--font-body": `var(${type.bodyVariable})`,
  } as React.CSSProperties;
  return (
    <div lang={metadata.language} className={`lw-site ${themeClass} ${type.classNames} min-h-screen bg-(--brand-bg) text-(--brand-text) font-(family-name:--font-body)`} style={style}>
      {/* The preset's files, preloaded so the first paint uses them (React hoists the links into <head>). */}
      {type.preload.map((href) => <link key={href} rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href={href} />)}
      {children}
    </div>
  );
}

export function siteLogo(ctx: RenderContext, surface: "light" | "dark" = "light"): SnapshotMedia | null {
  const { branding } = ctx.snapshot.config;
  const id = surface === "dark" ? branding.logoDarkAssetId : branding.logoAssetId;
  const media = id ? ctx.snapshot.media[id] ?? null : null;
  return media && Object.keys(media.variants).length > 0 ? media : null;
}

/**
 * The site's mark: the uploaded logo when the release carries one, otherwise the wordmark
 * as text. A logo's alternative text is its recorded alt text or the wordmark; a logo marked
 * decorative keeps the wordmark for assistive technology. On dark or primary-coloured
 * surfaces (`surface="dark"`) only the dark-surface logo is used; without one the wordmark is
 * shown, because a logo drawn for the light background may vanish there.
 */
export function BrandMark({ ctx, imageClass, textClass, surface = "light" }: { ctx: RenderContext; imageClass: string; textClass: string; surface?: "light" | "dark" }) {
  const { branding } = ctx.snapshot.config;
  const logo = siteLogo(ctx, surface);
  if (!logo) return <span className={textClass}>{branding.wordmark}</span>;
  const alt = logo.decorative ? "" : logo.alt.trim() || branding.wordmark;
  return (
    <>
      <Picture ctx={ctx} media={logo} sizes="240px" alt={alt} className={`${imageClass} w-auto max-w-60 object-contain object-left`} loading="eager" focal={false} />
      {alt ? null : <span className="sr-only">{branding.wordmark}</span>}
    </>
  );
}

/**
 * Anchor attributes for a navigation, footer or call-to-action link; external links never leak
 * the referrer. A document target (`document:<id>`, B5) opens the release's published copy; when
 * the release does not carry that document the link points at the page itself, so nothing breaks
 * (publication validation refuses such a link before it gets this far).
 */
export function linkProps(ctx: RenderContext, path: string): { href: string; rel?: string; type?: string } {
  if (/^document:/i.test(path)) {
    const media = ctx.snapshot.media[path.slice(9).toLowerCase()];
    const url = documentHref(ctx, path.slice(9).toLowerCase());
    return url ? { href: url, ...(media?.mime ? { type: media.mime } : {}) } : { href: href(ctx, ctx.path) };
  }
  return isExternalLink(path) ? { href: path, rel: "noreferrer" } : { href: href(ctx, path) };
}

export function showSearchLink(ctx: RenderContext): boolean {
  return ctx.snapshot.config.navigation.showSearch !== false;
}

/** Title and intro for a module listing page: the owner's copy when set, else the theme's default. */
export function indexCopy(ctx: RenderContext, kind: ContentKind, fallback: { title: string; intro: string }): { title: string; intro: string } {
  const moduleKey = kindRegistry[kind].module as IndexModuleKey | null;
  const copy = moduleKey ? ctx.snapshot.config.indexes?.[moduleKey] : undefined;
  return { title: copy?.title?.trim() || fallback.title, intro: copy?.intro?.trim() || fallback.intro };
}

/**
 * A page's featured image is its header image, unless the page opens with an image hero
 * (which already carries the page's main picture).
 */
export function pageHeaderImage(ctx: RenderContext, item: SnapshotItem): SnapshotMedia | null {
  const id = item.payload.featuredImageAssetId;
  if (typeof id !== "string") return null;
  const sections = item.payload.sections as Array<{ type?: string }> | undefined;
  if (sections?.[0]?.type === "image_hero") return null;
  const media = ctx.snapshot.media[id];
  return media && Object.keys(media.variants).length > 0 ? media : null;
}

export function inquiriesEnabled(ctx: RenderContext): boolean {
  return ctx.snapshot.config.modules.inquiries !== false;
}

import type { CSSProperties } from "react";
import type { SnapshotMedia } from "@/server/publishing/snapshot";
import type { RenderContext } from "@/themes/shared/types";

/**
 * Responsive image from published derivatives with explicit dimensions (no layout shift),
 * descriptive alternative text or an explicit decorative designation. When the asset has a
 * focal point, every crop made by `object-fit: cover` keeps it in view through
 * `object-position` (design programme D1); pass `focal={false}` for images that are never cropped.
 */
export function Picture({
  ctx,
  media,
  sizes,
  className = "",
  loading = "lazy",
  fetchPriority,
  alt,
  focal = true,
}: {
  ctx: RenderContext;
  media: SnapshotMedia;
  sizes: string;
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  /** Overrides the recorded alternative text (used for logos, whose text is the wordmark). */
  alt?: string;
  focal?: boolean;
}) {
  const variants = (["w480", "w960", "w1600"] as const).map((k) => ({ k, v: media.variants[k] })).filter((x) => x.v);
  if (variants.length === 0) return null;
  const largest = variants[variants.length - 1]!;
  const srcSet = variants.map((x) => `${ctx.assetUrl(media, x.k)} ${x.v!.width}w`).join(", ");
  const altText = alt !== undefined ? alt : media.decorative ? "" : media.alt;
  const style: CSSProperties | undefined = focal && media.focal ? { objectPosition: `${Math.round(media.focal.x * 100)}% ${Math.round(media.focal.y * 100)}%` } : undefined;
  return (
    <img
      src={ctx.assetUrl(media, largest.k)}
      srcSet={srcSet}
      sizes={sizes}
      width={largest.v!.width}
      height={largest.v!.height}
      alt={altText}
      {...(altText === "" ? { role: "presentation" } : {})}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      className={className}
      style={style}
    />
  );
}

import type { SnapshotMedia } from "@/server/publishing/snapshot";
import type { RenderContext } from "@/themes/shared/types";

/**
 * Responsive image from published derivatives with explicit dimensions (no layout shift),
 * descriptive alternative text or an explicit decorative designation.
 */
export function Picture({
  ctx,
  media,
  sizes,
  className = "",
  loading = "lazy",
  fetchPriority,
  alt,
}: {
  ctx: RenderContext;
  media: SnapshotMedia;
  sizes: string;
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  /** Overrides the recorded alternative text (used for logos, whose text is the wordmark). */
  alt?: string;
}) {
  const variants = (["w480", "w960", "w1600"] as const).map((k) => ({ k, v: media.variants[k] })).filter((x) => x.v);
  if (variants.length === 0) return null;
  const largest = variants[variants.length - 1]!;
  const srcSet = variants.map((x) => `${ctx.assetUrl(media, x.k)} ${x.v!.width}w`).join(", ");
  const altText = alt !== undefined ? alt : media.decorative ? "" : media.alt;
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
    />
  );
}

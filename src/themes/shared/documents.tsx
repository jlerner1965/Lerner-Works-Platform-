import type { PageSection } from "@/modules/page";
import type { Attachment } from "@/modules/common";
import type { RenderContext } from "@/themes/shared/types";
import type { SnapshotItem, SnapshotMedia } from "@/server/publishing/snapshot";
import { isSnapshotDocument } from "@/server/publishing/snapshot";
import { formatBytes } from "@/server/media/content-types";
import { columnsFor } from "@/themes/shared/design";
import { columnsClass, type SectionStyle } from "@/themes/shared/sections";

type Of<T extends PageSection["type"]> = Extract<PageSection, { type: T }>;

/**
 * Documents on the public site (site-building programme B5-1). A document in the release is
 * served from the same immutable content-hash store as pictures; every renderer here reads the
 * frozen snapshot only. Colours are the section variables; the layout choices are the section's
 * enumerated variant and columns (decision D-017).
 */

/** Public address of a document's published copy, or null when the release does not carry it. */
export function documentHref(ctx: RenderContext, assetId: string): string | null {
  const media = ctx.snapshot.media[assetId];
  return isSnapshotDocument(media) ? ctx.assetUrl(media, "file") : null;
}

/** The type shown beside a download ("PDF"). */
export function documentTypeLabel(media: SnapshotMedia): string {
  if (media.mime === "application/pdf" || media.variants.file?.path.endsWith(".pdf")) return "PDF";
  return "File";
}

/** A download's file name for the browser's save dialogue: the label or title, then the type. */
export function downloadFileName(media: SnapshotMedia, label: string): string {
  const base = (label || media.title || "document").replace(/[^A-Za-z0-9._ -]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "document";
  const ext = media.variants.file?.path.match(/\.([a-z0-9]+)$/i)?.[1] ?? "pdf";
  return `${base}.${ext}`;
}

interface DownloadEntry {
  media: SnapshotMedia;
  href: string;
  label: string;
  note: string;
}

function entries(ctx: RenderContext, items: ReadonlyArray<{ assetId: string; label?: string; note?: string }>): DownloadEntry[] {
  const out: DownloadEntry[] = [];
  for (const it of items) {
    const media = ctx.snapshot.media[it.assetId];
    const url = documentHref(ctx, it.assetId);
    if (!media || !url) continue;
    out.push({ media, href: url, label: it.label?.trim() || media.title || "Document", note: it.note?.trim() ?? "" });
  }
  return out;
}

/** One download: the title opens the document; the type and size say what it is; "Download" saves it under its own name. */
function DownloadRow({ entry, style, compact = false }: { entry: DownloadEntry; style: SectionStyle; compact?: boolean }) {
  const bytes = entry.media.variants.file?.bytes ?? 0;
  return (
    <div className="flex items-start gap-4">
      <span aria-hidden="true" className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-(--radius) border border-(--section-border) px-2 py-1 text-xs font-bold uppercase tracking-wider text-(--section-accent) ${compact ? "" : "min-w-12"}`}>{documentTypeLabel(entry.media)}</span>
      <div className="min-w-0 flex-1">
        <a href={entry.href} type={entry.media.mime} className={`${style.title} underline decoration-(--section-border) underline-offset-4 hover:decoration-(--section-fg)`}>{entry.label}</a>
        {entry.note ? <p className="mt-0.5 text-sm text-(--section-muted)">{entry.note}</p> : null}
        <p className="mt-0.5 text-xs text-(--section-muted)">
          {documentTypeLabel(entry.media)}{bytes ? ` · ${formatBytes(bytes)}` : ""}
          {" · "}
          <a href={entry.href} download={downloadFileName(entry.media, entry.label)} className="underline hover:text-(--section-fg)">Download</a>
        </p>
      </div>
    </div>
  );
}

/** The Downloads section of a page. */
export function DownloadsSection({ ctx, section, style }: { ctx: RenderContext; section: Of<"downloads">; style: SectionStyle }) {
  const list = entries(ctx, section.items);
  if (list.length === 0) return null;
  const variant = section.variant === "default" ? "list" : section.variant;
  return (
    <>
      {section.heading ? style.heading(section.heading) : null}
      {section.intro ? <p className={`${style.intro} mb-6`}>{section.intro}</p> : null}
      {variant === "grid" ? (
        <ul className={`grid gap-4 ${columnsClass[columnsFor(style.theme, "downloads", section.columns)]}`}>
          {list.map((entry) => (
            <li key={entry.media.id} className={`${style.panel} p-4`}>
              <DownloadRow entry={entry} style={style} compact />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-(--section-border) border-y border-(--section-border)">
          {list.map((entry) => (
            <li key={entry.media.id} className="py-4">
              <DownloadRow entry={entry} style={style} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * The documents attached to an item, under its body on the detail page. Nothing renders when
 * the item has none, so every release published before B5 keeps its output.
 */
export function Attachments({ ctx, item, style, className = "mt-10" }: { ctx: RenderContext; item: SnapshotItem; style: SectionStyle; className?: string }) {
  const attachments = (item.payload.attachments as Attachment[] | undefined) ?? [];
  const list = entries(ctx, attachments);
  if (list.length === 0) return null;
  const headingId = `downloads-${item.id.slice(0, 8)}`;
  return (
    <section aria-labelledby={headingId} className={className}>
      <h2 id={headingId} className={style.subtitle}>Downloads</h2>
      <ul className="mt-4 divide-y divide-(--section-border) border-y border-(--section-border)">
        {list.map((entry) => (
          <li key={entry.media.id} className="py-3">
            <DownloadRow entry={entry} style={style} />
          </li>
        ))}
      </ul>
    </section>
  );
}

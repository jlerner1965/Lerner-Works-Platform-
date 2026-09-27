import type { ReactNode } from "react";
import type { RenderContext } from "@/themes/shared/types";
import { href } from "@/themes/shared/types";
import type { SnapshotItem } from "@/server/publishing/snapshot";
import type { Block } from "@/lib/richtext";
import { linkHost } from "@/modules/link";
import { formatDateOnly } from "@/lib/events";
import { Picture } from "@/themes/shared/picture";
import { RichText } from "@/themes/shared/richtext";
import { featuredImage, itemPath, publishedItems } from "@/themes/shared/collections";
import { indexCopy } from "@/themes/shared/site-root";
import { columnsClass, type SectionStyle } from "@/themes/shared/sections";
import { Attachments } from "@/themes/shared/documents";

/**
 * Links to other websites on the public site (site-building programme B5-2), shared by every
 * composition through `SectionStyle`: cards that open the other site directly, the links
 * listing with its category filter, and each link's own small page. Every outside anchor is
 * https and carries `rel="noreferrer"`; nothing is fetched from the other site.
 */

/** Anchor attributes for the other website: never with a referrer, never anything but https. */
export function outsideLinkProps(item: SnapshotItem): { href: string; rel: string } {
  return { href: String(item.payload.url ?? ""), rel: "noreferrer" };
}

function Outside({ item, className, children }: { item: SnapshotItem; className?: string; children: ReactNode }) {
  return (
    <a {...outsideLinkProps(item)} className={className}>
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens another website)</span>
    </a>
  );
}

export function LinkCards({ ctx, items, style, columns = 3, variant = "default" }: { ctx: RenderContext; items: SnapshotItem[]; style: SectionStyle; columns?: 2 | 3 | 4; variant?: string }) {
  if (items.length === 0) return null;
  const about = (it: SnapshotItem) => {
    const path = itemPath(ctx, it);
    return path ? <a href={href(ctx, path)} className="underline hover:text-(--section-fg)">About this link</a> : null;
  };
  const meta = (it: SnapshotItem) => (
    <p className="mt-1 text-xs text-(--section-muted)">
      {linkHost(String(it.payload.url ?? ""))}
      {about(it) ? <> · {about(it)}</> : null}
    </p>
  );
  if (variant === "list" || variant === "text") {
    return (
      <ul className="divide-y divide-(--section-border) border-y border-(--section-border)">
        {items.map((it) => {
          const img = featuredImage(ctx, it);
          return (
            <li key={it.id} className="flex gap-5 py-4">
              {img && variant === "list" ? <Picture ctx={ctx} media={img} sizes="160px" className="aspect-[4/3] w-32 shrink-0 rounded-(--radius) object-cover sm:w-40" /> : null}
              <div className="min-w-0">
                {it.payload.category ? <p className={style.eyebrow}>{String(it.payload.category)}</p> : null}
                <h3 className={style.title}><Outside item={it} className="hover:underline">{it.title}</Outside></h3>
                {it.payload.summary ? <p className="mt-1 text-sm">{String(it.payload.summary)}</p> : null}
                {meta(it)}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className={`grid gap-6 ${columnsClass[columns]}`}>
      {items.map((it) => {
        const img = featuredImage(ctx, it);
        return (
          <li key={it.id} className={`${style.panel} flex flex-col overflow-hidden`}>
            {img ? <Picture ctx={ctx} media={img} sizes={`(min-width: 1024px) ${Math.round(100 / columns)}vw, (min-width: 640px) 50vw, 100vw`} className="aspect-[16/9] w-full object-cover" /> : null}
            <div className="flex flex-1 flex-col p-4">
              {it.payload.category ? <p className={style.eyebrow}>{String(it.payload.category)}</p> : null}
              <h3 className={`${style.title} mt-1`}><Outside item={it} className="hover:underline">{it.title}</Outside></h3>
              {it.payload.summary ? <p className="mt-2 text-sm text-(--section-muted)">{String(it.payload.summary)}</p> : null}
              <div className="mt-auto">{meta(it)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The links listing: the owner's title and introduction, a category filter, the cards. */
export function LinkIndex({ ctx, style }: { ctx: RenderContext; style: SectionStyle }) {
  const copy = indexCopy(ctx, "link", { title: "Links", intro: "Other websites we point to, with a word on why." });
  const all = publishedItems(ctx.snapshot, "link").sort((a, b) => a.title.localeCompare(b.title));
  const categories = [...new Set(all.map((i) => String(i.payload.category ?? "").trim()).filter(Boolean))].sort();
  const q = ctx.query.category ?? "";
  const items = q ? all.filter((i) => String(i.payload.category ?? "") === q) : all;
  const chip = "inline-block rounded-(--radius) border px-3 py-1 text-sm";
  return (
    <div>
      <h1 className={style.display}>{copy.title}</h1>
      {copy.intro ? <p className={style.intro}>{copy.intro}</p> : null}
      {categories.length > 1 ? (
        <nav aria-label="Filter by category" className="mt-6 flex flex-wrap gap-2">
          <a href={href(ctx, "/links")} className={`${chip} ${q ? "border-(--brand-border-strong) hover:border-(--section-heading)" : "border-(--brand-primary) bg-(--brand-primary) text-(--brand-on-primary)"}`} aria-current={q ? undefined : "page"}>All ({all.length})</a>
          {categories.map((c) => (
            <a key={c} href={`${href(ctx, "/links")}?category=${encodeURIComponent(c)}`} className={`${chip} ${q === c ? "border-(--brand-primary) bg-(--brand-primary) text-(--brand-on-primary)" : "border-(--brand-border-strong) hover:border-(--section-heading)"}`} aria-current={q === c ? "page" : undefined}>{c}</a>
          ))}
        </nav>
      ) : null}
      <div className="mt-8">
        {items.length === 0 ? (
          <div className={`${style.panel} p-6`}>
            <p className="font-semibold">{q ? "Nothing matches this category." : `Nothing has been published in ${copy.title.toLowerCase()} yet.`}</p>
            {q ? <p className="mt-1 text-sm"><a href={href(ctx, "/links")} className="underline">Show every link</a>.</p> : null}
          </div>
        ) : (
          <LinkCards ctx={ctx} items={items} style={style} columns={3} />
        )}
      </div>
    </div>
  );
}

/** A link's own page: the site's words about the other website, a picture, the button that opens it, and where the details were verified. */
export function OutsideLinkDetail({ ctx, item, style }: { ctx: RenderContext; item: SnapshotItem; style: SectionStyle }) {
  const p = item.payload as Record<string, unknown>;
  const url = String(p.url ?? "");
  const host = linkHost(url);
  const img = featuredImage(ctx, item);
  const label = String(p.ctaLabel ?? "").trim() || `Visit ${host}`;
  return (
    <article className="mx-auto max-w-3xl">
      <p className={style.eyebrow}>{[p.category ? String(p.category) : "Link", host].join(" · ")}</p>
      <h1 className={`mt-1 ${style.display}`}>{item.title}</h1>
      {p.summary ? <p className="mt-3 text-lg text-(--section-muted)">{String(p.summary)}</p> : null}
      {img ? <Picture ctx={ctx} media={img} sizes="(min-width: 768px) 720px, 100vw" className="mt-6 aspect-[16/9] w-full rounded-(--radius) object-cover" loading="eager" fetchPriority="high" /> : null}
      <p className="mt-6">
        <a {...outsideLinkProps(item)} className={style.buttonPrimary}>{label}<span aria-hidden="true"> ↗</span><span className="sr-only"> (opens another website)</span></a>
      </p>
      <RichText ctx={ctx} blocks={(p.body as Block[]) ?? []} className={`${style.prose} mt-6`} />
      <Attachments ctx={ctx} item={item} style={style} />
      <dl className="mt-8 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 border-y border-(--section-border) py-4 text-sm">
        <dt className={style.eyebrow}>Address</dt>
        <dd className="break-all"><a {...outsideLinkProps(item)} className="underline">{url}</a></dd>
        {p.lastVerifiedOn ? (
          <>
            <dt className={style.eyebrow}>Verified</dt>
            <dd>{formatDateOnly(String(p.lastVerifiedOn))}</dd>
          </>
        ) : null}
      </dl>
      <p className="mt-8 text-sm"><a href={href(ctx, "/links")} className="text-(--section-accent) underline">← All links</a></p>
    </article>
  );
}

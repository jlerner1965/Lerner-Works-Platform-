import type { ReactNode } from "react";
import { parseEmphasis, parseInline, type Block } from "@/lib/richtext";
import { href, type RenderContext } from "@/themes/shared/types";
import { Picture } from "@/themes/shared/picture";

/** Renders restricted body blocks. Text is escaped by React; links are resolved against the snapshot. */
export function RichText({ ctx, blocks, className = "" }: { ctx: RenderContext; blocks: Block[]; className?: string }) {
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "paragraph":
            return <p key={i}>{inline(ctx, b.text)}</p>;
          case "heading":
            return b.level === 2 ? <h2 key={i}>{b.text}</h2> : <h3 key={i}>{b.text}</h3>;
          case "list":
            return b.style === "bullet" ? (
              <ul key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>{inline(ctx, item)}</li>
                ))}
              </ul>
            ) : (
              <ol key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>{inline(ctx, item)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={i}>
                <p>{inline(ctx, b.text)}</p>
                {b.cite ? <cite>{b.cite}</cite> : null}
              </blockquote>
            );
          case "image": {
            const media = ctx.snapshot.media[b.assetId];
            if (!media) return null;
            return (
              <figure key={i}>
                <Picture ctx={ctx} media={media} sizes="(min-width: 768px) 720px, 100vw" />
                {b.caption ? <figcaption>{b.caption}</figcaption> : null}
              </figure>
            );
          }
        }
      })}
    </div>
  );
}

function emphasis(text: string): ReactNode {
  return parseEmphasis(text).map((node, i) => {
    if (node.type === "strong") return <strong key={i}>{node.text}</strong>;
    if (node.type === "em") return <em key={i}>{node.text}</em>;
    return <span key={i}>{node.text}</span>;
  });
}

export function inline(ctx: RenderContext, text: string): ReactNode {
  return parseInline(text).map((node, i) => {
    if (node.type === "strong") return <strong key={i}>{node.text}</strong>;
    if (node.type === "em") return <em key={i}>{node.text}</em>;
    if (node.type === "text") return <span key={i}>{node.text}</span>;
    const target = resolveLinkTarget(ctx, node.target ?? "");
    if (!target) return <span key={i}>{emphasis(node.text)}</span>;
    const external = target.startsWith("http");
    return (
      <a key={i} href={target} {...(external ? { rel: "noreferrer" } : {})}>
        {emphasis(node.text)}
      </a>
    );
  });
}

export function resolveLinkTarget(ctx: RenderContext, target: string): string | null {
  if (target.startsWith("item:")) {
    const route = ctx.snapshot.routes.find((r) => r.itemId === target.slice(5));
    return route ? href(ctx, route.path) : null;
  }
  if (target.startsWith("/")) return href(ctx, target);
  if (/^https:\/\//i.test(target)) return target;
  return null;
}

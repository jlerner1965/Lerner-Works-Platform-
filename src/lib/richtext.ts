import { z } from "zod";

/**
 * Restricted structured body content. Stored as JSON blocks; edited as a small line-based
 * markup ("structured text") that cannot carry HTML or scripts. Inline links use
 * [label](target) where target is a same-site path (/about), a stable item reference
 * (item:<uuid>) resolved at render time, or an https URL. Inline emphasis uses **bold** and
 * *italic* (or _italic_); nothing else is interpreted.
 */

export const inlineLinkTargetPattern = /^(?:\/[^\s)]*|item:[0-9a-f-]{36}|https:\/\/[^\s)]+)$/i;

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().max(4000) }),
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: z.string().min(1).max(200) }),
  z.object({
    type: z.literal("list"),
    style: z.enum(["bullet", "number"]),
    items: z.array(z.string().max(1000)).min(1).max(100),
  }),
  z.object({ type: z.literal("quote"), text: z.string().min(1).max(2000), cite: z.string().max(200).optional() }),
  z.object({ type: z.literal("image"), assetId: z.uuid(), caption: z.string().max(300).optional() }),
]);

export type Block = z.infer<typeof blockSchema>;
export const bodySchema = z.array(blockSchema).max(200);

export interface InlineNode {
  type: "text" | "link" | "strong" | "em";
  text: string;
  target?: string;
}

const linkPattern = /\[([^\]]{1,200})\]\(([^)\s]{1,500})\)/g;
const emphasisPattern = /\*\*([^*\n]{1,500}?)\*\*|\*([^*\n]{1,500}?)\*|(?<![A-Za-z0-9])_([^_\n]{1,500}?)_(?![A-Za-z0-9])/g;

/** Splits text into plain, bold and italic nodes. Unmatched markers stay literal. */
export function parseEmphasis(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const match of text.matchAll(emphasisPattern)) {
    const [whole, strong, em, em2] = match;
    const index = match.index ?? 0;
    if (index > last) nodes.push({ type: "text", text: text.slice(last, index) });
    if (strong !== undefined) nodes.push({ type: "strong", text: strong });
    else nodes.push({ type: "em", text: (em ?? em2)! });
    last = index + whole.length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes;
}

/** Splits paragraph text into text, emphasis and link nodes. Invalid link targets stay literal text. */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const match of text.matchAll(linkPattern)) {
    const [whole, label, target] = match;
    const index = match.index ?? 0;
    if (index > last) nodes.push(...parseEmphasis(text.slice(last, index)));
    if (target && inlineLinkTargetPattern.test(target)) {
      nodes.push({ type: "link", text: label ?? "", target });
    } else {
      nodes.push(...parseEmphasis(whole));
    }
    last = index + whole.length;
  }
  if (last < text.length) nodes.push(...parseEmphasis(text.slice(last)));
  return nodes;
}

/** Text without inline markup (link labels kept, emphasis markers removed). */
export function inlineToPlainText(text: string): string {
  return parseInline(text)
    .map((n) => (n.type === "link" ? parseEmphasis(n.text).map((e) => e.text).join("") : n.text))
    .join("");
}

/** Collects every link target used in a body (for publication validation). */
export function collectLinkTargets(blocks: Block[]): string[] {
  const targets: string[] = [];
  const scan = (text: string) => {
    for (const node of parseInline(text)) if (node.type === "link" && node.target) targets.push(node.target);
  };
  for (const b of blocks) {
    if (b.type === "paragraph" || b.type === "quote") scan(b.text);
    if (b.type === "list") b.items.forEach(scan);
  }
  return targets;
}

export function collectImageAssetIds(blocks: Block[]): string[] {
  return blocks.filter((b): b is Extract<Block, { type: "image" }> => b.type === "image").map((b) => b.assetId);
}

/** Parses the line-based structured text into blocks. Never produces HTML. */
export function parseStructuredText(input: string): Block[] {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { style: "bullet" | "number"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", style: list.style, items: list.items });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1]!.length === 2 ? 2 : 3, text: heading[2]!.trim() });
      continue;
    }
    const image = /^!image\s+([0-9a-f-]{36})(?:\s*\|\s*(.*))?$/i.exec(trimmed);
    if (image) {
      flushParagraph();
      flushList();
      const caption = image[2]?.trim();
      blocks.push({ type: "image", assetId: image[1]!.toLowerCase(), ...(caption ? { caption } : {}) });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flushParagraph();
      flushList();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "quote") prev.text = `${prev.text} ${quote[1]!.trim()}`.trim();
      else blocks.push({ type: "quote", text: quote[1]!.trim() });
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    const number = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (bullet || number) {
      flushParagraph();
      const style = bullet ? "bullet" : "number";
      const item = (bullet ?? number)![1]!.trim();
      if (list && list.style !== style) flushList();
      if (!list) list = { style, items: [] };
      list.items.push(item);
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return blocks.filter((b) => !(b.type === "paragraph" && b.text.length === 0));
}

/** Serializes blocks back to the structured text edited in the dashboard. */
export function serializeStructuredText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "paragraph":
          return b.text;
        case "heading":
          return `${"#".repeat(b.level)} ${b.text}`;
        case "list":
          return b.items.map((item, i) => (b.style === "bullet" ? `- ${item}` : `${i + 1}. ${item}`)).join("\n");
        case "quote":
          return `> ${b.text}`;
        case "image":
          return `!image ${b.assetId}${b.caption ? ` | ${b.caption}` : ""}`;
      }
    })
    .join("\n\n");
}

/** Plain-text rendering for search indexing and summaries. */
export function blocksToPlainText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "paragraph":
        case "quote":
          return inlineToPlainText(b.text);
        case "heading":
          return b.text;
        case "list":
          return b.items.map(inlineToPlainText).join(" ");
        case "image":
          return b.caption ?? "";
      }
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

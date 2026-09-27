import { z } from "zod";

/**
 * Restricted structured body content. Stored as JSON blocks; edited as a small line-based
 * markup ("structured text") that cannot carry HTML or scripts. Inline links use
 * [label](target) where target is a same-site path (/about), a stable item reference
 * (item:<uuid>) resolved at render time, a document in the media library (document:<uuid>,
 * site-building programme B5) or an https URL. Inline emphasis uses **bold** and
 * *italic* (or _italic_); nothing else is interpreted. Block markup: `## ` and `### ` headings,
 * `- ` and `1. ` lists, `> ` quotes, `!image ID | caption`, and since the site-building
 * programme's phase B3 `---` (a divider), `!note text` (a callout panel) and
 * `!button Label | target` (a link drawn as the theme's button).
 */

export const inlineLinkTargetPattern = /^(?:\/[^\s)]*|item:[0-9a-f-]{36}|document:[0-9a-f-]{36}|https:\/\/[^\s)]+)$/i;

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
  z.object({ type: z.literal("divider") }),
  z.object({ type: z.literal("callout"), text: z.string().min(1).max(2000) }),
  z.object({ type: z.literal("button"), label: z.string().min(1).max(80), target: z.string().max(500).regex(inlineLinkTargetPattern) }),
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
    if (b.type === "paragraph" || b.type === "quote" || b.type === "callout") scan(b.text);
    if (b.type === "list") b.items.forEach(scan);
    if (b.type === "button") targets.push(b.target);
  }
  return targets;
}

export function collectImageAssetIds(blocks: Block[]): string[] {
  return blocks.filter((b): b is Extract<Block, { type: "image" }> => b.type === "image").map((b) => b.assetId);
}

/** Documents linked from a body (`document:<uuid>` targets in links and buttons), for the release's media set (B5). */
export function collectDocumentAssetIds(blocks: Block[]): string[] {
  return collectLinkTargets(blocks)
    .filter((t) => /^document:[0-9a-f-]{36}$/i.test(t))
    .map((t) => t.slice(9).toLowerCase());
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
    if (/^(?:-{3,}|\*{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "divider" });
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
    const note = /^!note\s+(.+)$/i.exec(trimmed);
    if (note) {
      flushParagraph();
      flushList();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "callout") prev.text = `${prev.text} ${note[1]!.trim()}`.trim();
      else blocks.push({ type: "callout", text: note[1]!.trim() });
      continue;
    }
    // A button needs a label and a safe target; anything else stays literal text so the owner sees it.
    const button = /^!button\s+([^|]{1,80}?)\s*\|\s*(\S{1,500})$/i.exec(trimmed);
    if (button && inlineLinkTargetPattern.test(button[2]!)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "button", label: button[1]!.trim(), target: button[2]! });
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
        case "divider":
          return "---";
        case "callout":
          return `!note ${b.text}`;
        case "button":
          return `!button ${b.label} | ${b.target}`;
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
        case "callout":
          return inlineToPlainText(b.text);
        case "heading":
          return b.text;
        case "list":
          return b.items.map(inlineToPlainText).join(" ");
        case "image":
          return b.caption ?? "";
        case "divider":
          return "";
        case "button":
          return b.label;
      }
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

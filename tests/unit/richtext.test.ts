import { describe, expect, it } from "vitest";
import { parseStructuredText, serializeStructuredText, parseInline, collectLinkTargets, collectDocumentAssetIds, blocksToPlainText, bodySchema } from "@/lib/richtext";

describe("structured text", () => {
  it("parses paragraphs, headings, lists, quotes and images", () => {
    const blocks = parseStructuredText("## Welcome\n\nFirst paragraph\ncontinues here.\n\n- one\n- two\n\n1. a\n2. b\n\n> quoted\n\n!image 123e4567-e89b-12d3-a456-426614174000 | A caption");
    expect(blocks).toEqual([
      { type: "heading", level: 2, text: "Welcome" },
      { type: "paragraph", text: "First paragraph continues here." },
      { type: "list", style: "bullet", items: ["one", "two"] },
      { type: "list", style: "number", items: ["a", "b"] },
      { type: "quote", text: "quoted" },
      { type: "image", assetId: "123e4567-e89b-12d3-a456-426614174000", caption: "A caption" },
    ]);
  });
  it("round-trips through serialize", () => {
    const text = "## Title\n\nHello [there](/about) and [ref](item:123e4567-e89b-12d3-a456-426614174000).\n\n- x\n- y";
    expect(serializeStructuredText(parseStructuredText(text))).toBe(text);
  });
  it("never produces HTML and keeps script text literal", () => {
    const blocks = parseStructuredText("<script>alert(1)</script> [x](javascript:alert(1))");
    expect(blocks).toEqual([{ type: "paragraph", text: "<script>alert(1)</script> [x](javascript:alert(1))" }]);
    const inline = parseInline(blocks[0]!.type === "paragraph" ? blocks[0]!.text : "");
    expect(inline.every((n) => n.type === "text")).toBe(true);
  });
  it("accepts only safe link targets", () => {
    expect(parseInline("[a](/x) [b](https://e.example) [c](http://insecure) [d](item:123e4567-e89b-12d3-a456-426614174000)").filter((n) => n.type === "link").map((n) => n.target)).toEqual(["/x", "https://e.example", "item:123e4567-e89b-12d3-a456-426614174000"]);
    expect(collectLinkTargets(parseStructuredText("see [a](/x)\n\n- [b](https://y.example)"))).toEqual(["/x", "https://y.example"]);
  });
  it("links to documents in the media library (B5) from text and buttons, and collects them for the release", () => {
    const D = "123e4567-e89b-12d3-a456-426614174000";
    const blocks = parseStructuredText(`Read [the report](document:${D}) today.\n\n!button Download the map | document:${D.toUpperCase()}\n\n[bad](document:not-an-id)`);
    expect(blocks[0]).toEqual({ type: "paragraph", text: `Read [the report](document:${D}) today.` });
    expect(parseInline(`Read [the report](document:${D})`).find((n) => n.type === "link")?.target).toBe(`document:${D}`);
    expect(blocks[1]).toEqual({ type: "button", label: "Download the map", target: `document:${D.toUpperCase()}` });
    expect(parseInline("[bad](document:not-an-id)").every((n) => n.type === "text")).toBe(true);
    expect(collectDocumentAssetIds(blocks)).toEqual([D, D]);
    expect(bodySchema.safeParse(blocks).success).toBe(true);
  });
  it("renders plain text for indexing", () => {
    expect(blocksToPlainText(parseStructuredText("## H\n\nHello [w](/x) world\n\n- i"))).toBe("H Hello w world i");
  });
  it("parses bold and italic emphasis without interpreting anything else", () => {
    expect(parseInline("Plain **bold** and *italic* and _also italic_ text")).toEqual([
      { type: "text", text: "Plain " },
      { type: "strong", text: "bold" },
      { type: "text", text: " and " },
      { type: "em", text: "italic" },
      { type: "text", text: " and " },
      { type: "em", text: "also italic" },
      { type: "text", text: " text" },
    ]);
    // Emphasis around and inside links; unmatched markers and underscores in words stay literal.
    expect(parseInline("See **[the guide](/about)** now")).toEqual([
      { type: "text", text: "See **" },
      { type: "link", text: "the guide", target: "/about" },
      { type: "text", text: "** now" },
    ]);
    expect(parseInline("[**bold label**](/x)")).toEqual([{ type: "link", text: "**bold label**", target: "/x" }]);
    expect(parseInline("snake_case_name and 2*3*4 and *unclosed")).toEqual([
      { type: "text", text: "snake_case_name and 2" },
      { type: "em", text: "3" },
      { type: "text", text: "4 and *unclosed" },
    ]);
    expect(parseInline("<b>html</b> **stays** text").some((n) => n.type === "strong")).toBe(true);
    expect(blocksToPlainText(parseStructuredText("Hello **bold** and *it* [**l**](/x)\n\n- **item**"))).toBe("Hello bold and it l item");
  });
  it("parses dividers, callouts and buttons (B3), keeps an unsafe button literal, and round-trips", () => {
    const text = "Intro\n\n---\n\n!note Bring **boots**.\n!note And water.\n\n!button Plan a visit | /contact\n\n!button Bad | javascript:alert(1)";
    const blocks = parseStructuredText(text);
    expect(blocks).toEqual([
      { type: "paragraph", text: "Intro" },
      { type: "divider" },
      { type: "callout", text: "Bring **boots**. And water." },
      { type: "button", label: "Plan a visit", target: "/contact" },
      { type: "paragraph", text: "!button Bad | javascript:alert(1)" },
    ]);
    expect(serializeStructuredText(blocks.slice(0, 4))).toBe("Intro\n\n---\n\n!note Bring **boots**. And water.\n\n!button Plan a visit | /contact");
    expect(parseStructuredText("***\n\n!button See the guide | item:123e4567-e89b-12d3-a456-426614174000")).toEqual([{ type: "divider" }, { type: "button", label: "See the guide", target: "item:123e4567-e89b-12d3-a456-426614174000" }]);
    expect(collectLinkTargets(blocks)).toEqual(["/contact"]);
    expect(blocksToPlainText(blocks)).toBe("Intro Bring boots. And water. Plan a visit !button Bad | javascript:alert(1)");
    expect(bodySchema.safeParse(blocks).success).toBe(true);
    expect(bodySchema.safeParse([{ type: "button", label: "x", target: "javascript:alert(1)" }]).success).toBe(false);
  });
});

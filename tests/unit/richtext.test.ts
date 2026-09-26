import { describe, expect, it } from "vitest";
import { parseStructuredText, serializeStructuredText, parseInline, collectLinkTargets, blocksToPlainText } from "@/lib/richtext";

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
  it("renders plain text for indexing", () => {
    expect(blocksToPlainText(parseStructuredText("## H\n\nHello [w](/x) world\n\n- i"))).toBe("H Hello w world i");
  });
});

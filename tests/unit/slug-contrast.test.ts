import { describe, expect, it } from "vitest";
import { slugify, isValidSlug } from "@/lib/slug";
import { contrastRatio } from "@/lib/contrast";

describe("slugify", () => {
  it("normalizes text to a valid slug", () => {
    expect(slugify("  Pine Hollow — Café & Bakery! ")).toBe("pine-hollow-cafe-bakery");
    expect(isValidSlug(slugify("Range Athletics: Longmont"))).toBe(true);
    expect(slugify("---")).toBe("");
  });
});

describe("contrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#2f5d3a", "#f7f4ec")).toBeGreaterThan(4.5);
    expect(contrastRatio("#e8611a", "#ffffff")).toBeLessThan(4.5);
  });
});

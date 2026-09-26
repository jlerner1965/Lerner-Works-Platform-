import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brandCssVariables, brandPairings, deriveBrandTokens, failingPairings, mix } from "@/lib/brand-tokens";
import { contrastRatio } from "@/lib/contrast";
import { presets } from "@/modules/presets";
import { siteConfigSchema } from "@/modules/site-config";

const guide = siteConfigSchema.parse(presets.community_guide.config({ siteName: "G" })).branding.colors;
const locations = siteConfigSchema.parse(presets.location_business.config({ siteName: "L" })).branding.colors;

describe("derived brand tokens", () => {
  it("mixes colours per sRGB channel", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#ff0000", "#0000ff", 0)).toBe("#ff0000");
    expect(mix("#ff0000", "#0000ff", 1)).toBe("#0000ff");
  });

  it("keeps both pilot palettes readable and their button text white", () => {
    for (const colors of [guide, locations]) {
      const t = deriveBrandTokens(colors);
      expect(failingPairings(colors)).toEqual([]);
      expect(t.onPrimary).toBe("#ffffff");
      expect(t.onAccent).toBe("#ffffff");
      expect(contrastRatio(t.muted, colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.borderStrong, colors.background)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.focus, colors.background)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.danger, colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.success, colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.danger, t.dangerSoft)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("derives dark button text and lightened status colours on a dark palette", () => {
    const dark = { primary: "#f2c14e", accent: "#7fd1b9", background: "#101418", text: "#f4f1ea" };
    const t = deriveBrandTokens(dark);
    expect(failingPairings(dark)).toEqual([]);
    expect(t.onPrimary).toBe(dark.background);
    expect(t.onAccent).toBe(dark.background);
    expect(contrastRatio(t.danger, dark.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.success, dark.background)).toBeGreaterThanOrEqual(4.5);
    // Surfaces move toward the text colour: lighter than a dark background.
    expect(contrastRatio(t.surface, "#000000")).toBeGreaterThan(contrastRatio(dark.background, "#000000"));
  });

  it("names every failing pairing, including tinted panels and non-text indicators", () => {
    const pale = { primary: "#e9d8a6", accent: "#e8611a", background: "#ffffff", text: "#222222" };
    const failing = failingPairings(pale).map((p) => p.id);
    expect(failing).toEqual(["primary-bg", "primary-surface", "accent-bg", "accent-surface"]);
    const hopeless = { primary: "#ffffff", accent: "#eeeeee", background: "#ffffff", text: "#dddddd" };
    const ids = failingPairings(hopeless).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["text-bg", "text-surface", "focus-bg", "border-strong-bg"]));
    expect(brandPairings(hopeless).every((p) => p.minimum === 4.5 || p.minimum === 3)).toBe(true);
  });

  it("applies owner overrides to derived tokens and gates the result", () => {
    const t = deriveBrandTokens(guide, { surface: "#FFFFFF", muted: "#777777", focus: "" });
    expect(t.surface).toBe("#ffffff");
    expect(t.muted).toBe("#777777");
    expect(t.focus).toBe(deriveBrandTokens(guide).focus);
    // A too-light muted override fails the gate by name.
    expect(failingPairings(guide, { muted: "#bbbbbb" }).map((p) => p.id)).toEqual(["muted-bg"]);
    expect(brandPairings(guide).length).toBe(15);
  });

  it("exposes one CSS variable per token", () => {
    const vars = brandCssVariables(deriveBrandTokens(guide));
    expect(Object.keys(vars).sort()).toEqual([
      "--brand-accent", "--brand-bg", "--brand-border", "--brand-border-strong", "--brand-danger", "--brand-danger-soft", "--brand-focus", "--brand-muted",
      "--brand-on-accent", "--brand-on-primary", "--brand-on-text", "--brand-primary", "--brand-success", "--brand-success-soft", "--brand-surface", "--brand-surface-strong", "--brand-text",
    ]);
    expect(Object.values(vars).every((v) => /^#[0-9a-f]{6}$/.test(v))).toBe(true);
  });
});

/** Rendering audit (DES-03): the public themes contain no literal colours; every colour is a brand token. */
describe("theme colour audit", () => {
  const files = walk(path.resolve("src/themes")).filter((f) => /\.(tsx|ts|css)$/.test(f) && !f.includes("/fonts/"));
  const hexLiteral = /#[0-9a-fA-F]{3,8}\b/;
  const paletteClass = /\b(?:text|bg|border|divide|ring|outline|fill|stroke|from|to|via|shadow|decoration|accent|caret)-(?:white|black|transparent|current|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/\d{1,3})?\b/;
  const opacityTint = /\(--brand-[a-z-]+\)\/\d{1,3}/;
  it("has no hex colours, palette classes or opacity-faded brand colours in theme code", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      text.split("\n").forEach((line, i) => {
        // "transparent" is the absence of a colour (invisible borders, a header overlaid on a hero image), not a palette pick.
        const cleaned = line.replace(/\b(?:border|bg)-transparent\b/g, "");
        if (hexLiteral.test(cleaned) || paletteClass.test(cleaned) || opacityTint.test(cleaned)) offenders.push(`${path.relative(process.cwd(), f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
  it("keeps the public prose styles on brand tokens", () => {
    const css = fs.readFileSync(path.resolve("src/app/globals.css"), "utf8");
    const publicPart = css.slice(css.indexOf(".lw-site"));
    expect(publicPart.length).toBeGreaterThan(100);
    expect(hexLiteral.test(publicPart)).toBe(false);
    expect(/opacity:\s*0\.\d/.test(publicPart)).toBe(false);
  });
});

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

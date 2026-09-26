import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { themes, getTheme } from "@/themes";
import { themeCapabilities, themesForPreset, themeKeyFor, themeKeyForPreset, themeCompatibilityIssues, capabilitiesFor } from "@/themes/capabilities";
import { typographyPresets } from "@/themes/fonts";
import { siteConfigSchema, themeKeys, typographyPresetKeys } from "@/modules/site-config";
import { sectionVariants, type SectionType } from "@/modules/page";
import { presets } from "@/modules/presets";
import { normalizeSnapshot, type ReleaseSnapshot } from "@/server/publishing/snapshot";
import { resolveRoute } from "@/server/publishing/public-site";
import { makeRenderContext } from "@/server/publishing/render";

/** Design programme D2: the theme catalogue (decision D-017: compositions in code, fixed vocabularies). */
describe("theme catalogue", () => {
  it("registers every theme key under its own key with capabilities and at least one preset", () => {
    for (const key of themeKeys) {
      expect(themes[key]?.key, key).toBe(key);
      const caps = themeCapabilities[key];
      expect(caps.key).toBe(key);
      expect(caps.presets.length).toBeGreaterThan(0);
      expect(caps.description.length).toBeGreaterThan(20);
      expect(caps.header).toContain(caps.defaults.header);
      expect(caps.hero).toContain(caps.defaults.hero);
      expect(caps.cards).toContain(caps.defaults.cards);
      for (const type of caps.sectionTypes) {
        expect(caps.variants[type], `${key} ${type}`).toContain("default");
        for (const v of caps.variants[type]) expect(sectionVariants[type as SectionType], `${key} ${type} ${v}`).toContain(v);
      }
    }
  });

  it("lists the compatible themes per preset with the preset's original composition first", () => {
    expect(themesForPreset("community_guide").map((t) => t.key)).toEqual(["guide", "magazine"]);
    expect(themesForPreset("location_business").map((t) => t.key)).toEqual(["locations", "storefront"]);
    expect(themeKeyForPreset("community_guide")).toBe("guide");
    expect(themeKeyForPreset("location_business")).toBe("locations");
  });

  it("resolves the theme from the configuration and falls back to the preset's composition when the choice does not fit", () => {
    expect(themeKeyFor("community_guide", undefined)).toBe("guide");
    expect(themeKeyFor("community_guide", { theme: "default" })).toBe("guide");
    expect(themeKeyFor("community_guide", { theme: "magazine" })).toBe("magazine");
    expect(themeKeyFor("community_guide", { theme: "storefront" })).toBe("guide");
    expect(themeKeyFor("location_business", { theme: "storefront" })).toBe("storefront");
    expect(themeCompatibilityIssues("community_guide", { theme: "storefront" })).toEqual([expect.objectContaining({ path: "design.theme", message: expect.stringContaining("not written for this site's preset") })]);
    expect(themeCompatibilityIssues("community_guide", { theme: "magazine" })).toEqual([]);
    expect(capabilitiesFor("location_business", { theme: "storefront" }).header).toContain("overlay");
    expect(capabilitiesFor("location_business", { theme: "default" }).header).not.toContain("overlay");
  });

  it("gives the configuration a theme, a dark logo slot and a header button with safe defaults", () => {
    const config = siteConfigSchema.parse(presets.location_business.config({ siteName: "Test" }));
    expect(config.design.theme).toBe("default");
    expect(config.branding.logoDarkAssetId).toBeNull();
    expect(config.navigation.cta).toEqual({ label: "", path: "" });
    // A configuration that already carries the defaults parses again (the settings actions re-parse the current revision).
    expect(siteConfigSchema.safeParse(config).success).toBe(true);
    expect(siteConfigSchema.safeParse({ ...config, design: { ...config.design, theme: "carousel" } }).success).toBe(false);
    expect(siteConfigSchema.safeParse({ ...config, navigation: { ...config.navigation, cta: { label: "Book", path: "not a path" } } }).success).toBe(false);
  });

  it("has a self-hosted typography preset for every key, with every preloaded file present under public/", () => {
    const css = fs.readFileSync(path.resolve("src/app/globals.css"), "utf8");
    for (const key of typographyPresetKeys) {
      const preset = typographyPresets[key];
      expect(preset.key).toBe(key);
      expect(preset.headingVariable.startsWith("--font-")).toBe(true);
      expect(preset.bodyVariable.startsWith("--font-")).toBe(true);
      expect(preset.classNames.length).toBeGreaterThan(0);
      expect(preset.preload.length).toBeGreaterThan(0);
      for (const file of preset.preload) {
        expect(file.startsWith("/fonts/"), file).toBe(true);
        expect(fs.existsSync(path.resolve("public", file.slice(1))), `${file} exists`).toBe(true);
        expect(css, `${file} declared in globals.css`).toContain(`url(${file})`);
      }
      for (const cls of preset.classNames.split(" ")) expect(css, `${cls} defined in globals.css`).toContain(`.${cls} {`);
    }
  });
});

describe("every composition renders every route of the frozen pilot releases", () => {
  const dir = path.resolve("tests/fixtures/releases");
  const files = fs.readdirSync(dir).filter((f) => /-v3\.json$/.test(f));
  const clock = new Date("2026-09-26T12:00:00Z");
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as ReleaseSnapshot;
    const base = normalizeSnapshot(raw)!;
    for (const theme of themesForPreset(base.site.preset)) {
      it(`${file} under ${theme.key}`, () => {
        const snapshot: ReleaseSnapshot = { ...base, config: { ...base.config, design: { ...base.config.design, theme: theme.key } } };
        expect(getTheme(snapshot).key).toBe(theme.key);
        const basePath = `/demo/${snapshot.site.key}`;
        for (const route of snapshot.routes) {
          const ctx = makeRenderContext({ snapshot, basePath, mode: "demo", path: route.path, query: {}, inquiryEndpoint: `${basePath}/inquiries`, releaseVersion: 1, publishedAt: clock, now: clock });
          const html = renderToStaticMarkup(getTheme(snapshot).render(ctx, resolveRoute(snapshot, route.path)));
          expect(html.length, `${theme.key} ${route.path}`).toBeGreaterThan(500);
          expect(html, `${theme.key} ${route.path} theme class`).toContain(`${theme.key}-theme`);
          expect(html, `${theme.key} ${route.path} skip link`).toContain('href="#content"');
          expect(html, `${theme.key} ${route.path} main landmark`).toContain('id="content"');
        }
      });
    }
  }
});

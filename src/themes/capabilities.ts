import type { PresetKey } from "@/modules/presets";
import { sectionVariants, type SectionType } from "@/modules/page";
import type { SiteDesign } from "@/modules/site-config";

/**
 * What each theme can render (design programme D-014: fixed vocabularies, validated twice).
 * The editor offers only these types and variants; saving, importing and publishing reject
 * anything else with a message that names the section, the value and the theme. This file
 * has no rendering code so it can be imported by server actions and client forms alike.
 */
export type ThemeKey = "guide" | "locations";
export type HeaderStyle = "left" | "centered";
export type HeroStyle = "split" | "full" | "stacked";
export type CardStyle = "image-top" | "image-side" | "text";

export interface ThemeCapabilities {
  key: ThemeKey;
  label: string;
  sectionTypes: SectionType[];
  /** Allowed variants per section type; every list includes "default". */
  variants: Record<SectionType, readonly string[]>;
  header: HeaderStyle[];
  hero: HeroStyle[];
  cards: CardStyle[];
  /** What "default" resolves to for this theme. */
  defaults: { header: HeaderStyle; hero: HeroStyle; cards: CardStyle };
}

const allTypes = Object.keys(sectionVariants) as SectionType[];
const without = <T extends SectionType>(type: T, ...excluded: string[]): readonly string[] => sectionVariants[type].filter((v) => !excluded.includes(v));

export const themeCapabilities: Record<ThemeKey, ThemeCapabilities> = {
  guide: {
    key: "guide",
    label: "Community guide (editorial)",
    sectionTypes: allTypes.filter((t) => t !== "location_collection"),
    variants: { ...sectionVariants },
    header: ["left", "centered"],
    hero: ["split", "full", "stacked"],
    cards: ["image-top", "image-side", "text"],
    defaults: { header: "left", hero: "split", cards: "image-top" },
  },
  locations: {
    key: "locations",
    label: "Location business (retail)",
    sectionTypes: allTypes,
    variants: {
      ...sectionVariants,
      // The retail composition uses full-width imagery; text-beside-image heroes and the
      // editorial "featured item" article layout belong to the guide.
      image_hero: without("image_hero", "split"),
      content_collection: without("content_collection", "featured"),
    },
    header: ["left", "centered"],
    hero: ["full", "stacked"],
    cards: ["image-top", "image-side", "text"],
    defaults: { header: "left", hero: "full", cards: "image-top" },
  },
};

export function themeKeyForPreset(preset: PresetKey): ThemeKey {
  return preset === "community_guide" ? "guide" : "locations";
}

export function capabilitiesForPreset(preset: PresetKey): ThemeCapabilities {
  return themeCapabilities[themeKeyForPreset(preset)];
}

export interface CapabilityIssue {
  path: string;
  message: string;
}

/** Sections whose type or variant the theme does not render. `prefix` is the payload path of the sections array. */
export function sectionCapabilityIssues(theme: ThemeKey, sections: ReadonlyArray<{ type: string; variant?: string }>, prefix = "sections"): CapabilityIssue[] {
  const caps = themeCapabilities[theme];
  const issues: CapabilityIssue[] = [];
  sections.forEach((s, i) => {
    if (!caps.sectionTypes.includes(s.type as SectionType)) {
      issues.push({ path: `${prefix}.${i}.type`, message: `Section ${i + 1}: the ${caps.label} theme does not render "${s.type}" sections.` });
      return;
    }
    const variant = s.variant ?? "default";
    const allowed = caps.variants[s.type as SectionType];
    if (!allowed.includes(variant)) {
      issues.push({ path: `${prefix}.${i}.variant`, message: `Section ${i + 1}: the ${caps.label} theme does not offer the "${variant}" style for ${s.type} sections; choose one of ${allowed.join(", ")}.` });
    }
  });
  return issues;
}

/** Design options the theme does not offer. */
export function designCapabilityIssues(theme: ThemeKey, design: Pick<SiteDesign, "header" | "hero" | "cards">): CapabilityIssue[] {
  const caps = themeCapabilities[theme];
  const issues: CapabilityIssue[] = [];
  if (design.header !== "default" && !caps.header.includes(design.header)) issues.push({ path: "design.header", message: `The ${caps.label} theme does not offer the "${design.header}" header style.` });
  if (design.hero !== "default" && !caps.hero.includes(design.hero)) issues.push({ path: "design.hero", message: `The ${caps.label} theme does not offer the "${design.hero}" hero style.` });
  if (design.cards !== "default" && !caps.cards.includes(design.cards)) issues.push({ path: "design.cards", message: `The ${caps.label} theme does not offer the "${design.cards}" card style.` });
  return issues;
}

/** Concrete header, hero and card styles for a theme once "default" is resolved. */
export function resolveDesign(theme: ThemeKey, design: Pick<SiteDesign, "header" | "hero" | "cards">): { header: HeaderStyle; hero: HeroStyle; cards: CardStyle } {
  const d = themeCapabilities[theme].defaults;
  return {
    header: design.header === "default" ? d.header : design.header,
    hero: design.hero === "default" ? d.hero : design.hero,
    cards: design.cards === "default" ? d.cards : design.cards,
  };
}

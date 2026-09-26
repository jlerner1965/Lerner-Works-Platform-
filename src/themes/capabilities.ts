import type { PresetKey } from "@/modules/presets";
import { sectionVariants, type SectionType } from "@/modules/page";
import type { SiteDesign, ThemeKey } from "@/modules/site-config";

/**
 * What each theme can render (design programme D-014 and D-017: fixed vocabularies, validated
 * twice). The editor offers only these types and variants; saving, importing and publishing
 * reject anything else with a message that names the section, the value and the theme. A
 * site chooses one of the themes compatible with its preset (`design.theme`, "default" being
 * the preset's original composition); the choice is a configuration revision, frozen into
 * releases, so an old release keeps rendering with the theme it was published with. This file
 * has no rendering code so it can be imported by server actions and client forms alike.
 */
export type { ThemeKey };
export type HeaderStyle = "left" | "centered" | "overlay";
export type HeroStyle = "split" | "full" | "stacked";
export type CardStyle = "image-top" | "image-side" | "text";

export interface ThemeCapabilities {
  key: ThemeKey;
  label: string;
  /** One sentence for the theme select and the catalogue. */
  description: string;
  /** Presets this composition is written for; a site of another preset cannot select it. */
  presets: PresetKey[];
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
    description: "Serif editorial guide: text-led home, list-heavy events, image cards for places.",
    presets: ["community_guide"],
    sectionTypes: allTypes.filter((t) => t !== "location_collection"),
    variants: { ...sectionVariants },
    header: ["left", "centered"],
    hero: ["split", "full", "stacked"],
    cards: ["image-top", "image-side", "text"],
    defaults: { header: "left", hero: "split", cards: "image-top" },
  },
  magazine: {
    key: "magazine",
    label: "Magazine (feature-led)",
    description: "Magazine guide: centred masthead, one large feature on the home page, dense card grids and a sidebar on articles.",
    presets: ["community_guide"],
    sectionTypes: allTypes.filter((t) => t !== "location_collection"),
    variants: { ...sectionVariants },
    header: ["left", "centered"],
    hero: ["split", "full", "stacked"],
    cards: ["image-top", "image-side", "text"],
    defaults: { header: "centered", hero: "full", cards: "image-top" },
  },
  locations: {
    key: "locations",
    label: "Location business (retail)",
    description: "Retail storefront: bold uppercase headings, store cards with live hours, services in a grid.",
    presets: ["location_business"],
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
  storefront: {
    key: "storefront",
    label: "Storefront (bold)",
    description: "Bold storefront: dark header bar with the store finder, header over an accent hero band, store tiles with status badges, service rows.",
    presets: ["location_business"],
    sectionTypes: allTypes,
    variants: {
      ...sectionVariants,
      content_collection: without("content_collection", "featured"),
    },
    header: ["left", "centered", "overlay"],
    hero: ["split", "full", "stacked"],
    cards: ["image-top", "image-side", "text"],
    defaults: { header: "overlay", hero: "full", cards: "image-top" },
  },
};

/** Each preset's original composition, used when `design.theme` is "default" (and by releases published before D2). */
const defaultThemeForPreset: Record<PresetKey, ThemeKey> = { community_guide: "guide", location_business: "locations" };

export function themeKeyForPreset(preset: PresetKey): ThemeKey {
  return defaultThemeForPreset[preset];
}

/** Themes a site of this preset may choose, the preset's own first. */
export function themesForPreset(preset: PresetKey): ThemeCapabilities[] {
  const all = Object.values(themeCapabilities).filter((t) => t.presets.includes(preset));
  return [...all.filter((t) => t.key === defaultThemeForPreset[preset]), ...all.filter((t) => t.key !== defaultThemeForPreset[preset])];
}

/**
 * The theme a site renders with: its chosen theme when it is one written for the preset,
 * otherwise the preset's original composition. Configuration older than D2 has no theme
 * field and resolves to the original composition, so earlier releases render as published.
 */
export function themeKeyFor(preset: PresetKey, design: Pick<SiteDesign, "theme"> | undefined): ThemeKey {
  const chosen = design?.theme ?? "default";
  if (chosen === "default") return defaultThemeForPreset[preset];
  const caps = themeCapabilities[chosen];
  return caps && caps.presets.includes(preset) ? chosen : defaultThemeForPreset[preset];
}

export function capabilitiesForPreset(preset: PresetKey): ThemeCapabilities {
  return themeCapabilities[themeKeyForPreset(preset)];
}

export function capabilitiesFor(preset: PresetKey, design: Pick<SiteDesign, "theme"> | undefined): ThemeCapabilities {
  return themeCapabilities[themeKeyFor(preset, design)];
}

export interface CapabilityIssue {
  path: string;
  message: string;
}

/** A theme chosen for a site whose preset it is not written for. */
export function themeCompatibilityIssues(preset: PresetKey, design: Pick<SiteDesign, "theme">): CapabilityIssue[] {
  if (design.theme === "default") return [];
  const caps = themeCapabilities[design.theme];
  if (caps && caps.presets.includes(preset)) return [];
  return [{ path: "design.theme", message: `The ${caps ? caps.label : design.theme} theme is not written for this site's preset; choose one of ${themesForPreset(preset).map((t) => t.label).join(", ")}.` }];
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

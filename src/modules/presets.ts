import type { SiteConfigInput } from "@/modules/site-config";
import type { PagePayloadInput } from "@/modules/page";

export type PresetKey = "community_guide" | "location_business";

export interface PresetDefinition {
  key: PresetKey;
  label: string;
  description: string;
  defaultTimeZone: string;
  /** Starting configuration; callers parse it through `siteConfigSchema` to apply defaults. */
  config: (input: { siteName: string }) => SiteConfigInput;
  /**
   * Initial pages for a clean site: a real structure whose slots fill themselves from the
   * site's content (category list, latest places, upcoming events) or wait for the owner's
   * words (introduction, About). No fictional copy; a slot with nothing to show is left out
   * of the public page until it has something (site-building programme B2, D-021). Parsed
   * through the page schema when created.
   */
  initialPages: (input: { siteName: string }) => Array<{ slug: string; title: string; payload: PagePayloadInput }>;
  kinds: Array<"page" | "place" | "event" | "article" | "store" | "service" | "link">;
}

const uid = (n: string) => `s-${n}`;

export const presets: Record<PresetKey, PresetDefinition> = {
  community_guide: {
    key: "community_guide",
    label: "Community guide",
    description: "Editorial local guide with a place directory, events calendar and short articles.",
    defaultTimeZone: "America/Denver",
    kinds: ["page", "place", "event", "article", "link"],
    config: ({ siteName }) => ({
      schemaVersion: 1,
      branding: {
        wordmark: siteName,
        tagline: "",
        logoAssetId: null,
        colors: { primary: "#2f5d3a", accent: "#a4502b", background: "#f7f4ec", text: "#25302a" },
        typography: "editorial-serif",
      },
      navigation: {
        items: [
          { label: "Directory", path: "/places" },
          { label: "Events", path: "/events" },
          { label: "Articles", path: "/articles" },
          { label: "About", path: "/about" },
          { label: "Contact", path: "/contact" },
        ],
      },
      footer: { text: "", links: [{ label: "About", path: "/about" }, { label: "Contact", path: "/contact" }], showContactDetails: true },
      modules: { places: true, events: true, articles: true, stores: false, services: false, inquiries: true, links: true },
      metadata: { defaultTitle: siteName, titleSuffix: siteName, defaultDescription: "" },
    }),
    initialPages: ({ siteName }) => [
      {
        slug: "home",
        title: "Home",
        payload: page({
          title: "Home",
          slug: "home",
          sections: [
            { id: uid("hero"), type: "image_hero", heading: siteName, subheading: "", imageAssetId: null, ctaLabel: "Browse the directory", ctaPath: "/places" },
            { id: uid("intro"), type: "rich_text", heading: `About ${siteName}`, body: [] },
            { id: uid("cats"), type: "category_list", heading: "Browse by category" },
            { id: uid("places"), type: "content_collection", heading: "From the directory", kind: "place", mode: "latest", itemIds: [], limit: 6 },
            { id: uid("events"), type: "content_collection", heading: "Upcoming events", kind: "event", mode: "upcoming", itemIds: [], limit: 4 },
            { id: uid("articles"), type: "content_collection", heading: "Latest articles", kind: "article", mode: "latest", itemIds: [], limit: 3 },
            { id: uid("contact"), type: "contact_callout", heading: "Know a place we should list?", text: "", showContactDetails: true },
          ],
        }),
      },
      {
        slug: "about",
        title: "About",
        payload: page({ title: "About", slug: "about", sections: [{ id: uid("about"), type: "rich_text", heading: `About ${siteName}`, body: [] }] }),
      },
      {
        slug: "contact",
        title: "Contact",
        payload: page({
          title: "Contact",
          slug: "contact",
          sections: [
            { id: uid("callout"), type: "contact_callout", heading: "Get in touch", text: "", showContactDetails: true },
            { id: uid("form"), type: "inquiry_form", heading: "Send a message", intro: "", locationSelect: false },
          ],
        }),
      },
    ],
  },
  location_business: {
    key: "location_business",
    label: "Location business",
    description: "Multi-location retail or service business with store pages, hours, services and inquiries.",
    defaultTimeZone: "America/Denver",
    kinds: ["page", "store", "service", "link"],
    config: ({ siteName }) => ({
      schemaVersion: 1,
      branding: {
        wordmark: siteName,
        tagline: "",
        logoAssetId: null,
        colors: { primary: "#12213a", accent: "#bf4a0d", background: "#ffffff", text: "#111827" },
        typography: "utility-sans",
      },
      navigation: {
        items: [
          { label: "Locations", path: "/locations" },
          { label: "Services", path: "/services" },
          { label: "About", path: "/about" },
          { label: "Contact", path: "/contact" },
        ],
      },
      footer: { text: "", links: [{ label: "Locations", path: "/locations" }, { label: "Contact", path: "/contact" }], showContactDetails: true },
      modules: { places: false, events: false, articles: false, stores: true, services: true, inquiries: true, links: true },
      metadata: { defaultTitle: siteName, titleSuffix: siteName, defaultDescription: "" },
    }),
    initialPages: ({ siteName }) => [
      {
        slug: "home",
        title: "Home",
        payload: page({
          title: "Home",
          slug: "home",
          sections: [
            { id: uid("hero"), type: "text_hero", heading: siteName, subheading: "", ctaLabel: "Find a store", ctaPath: "/locations" },
            { id: uid("intro"), type: "rich_text", heading: `About ${siteName}`, body: [] },
            { id: uid("stores"), type: "location_collection", heading: "Find a store", mode: "all", itemIds: [] },
            { id: uid("services"), type: "content_collection", heading: "Services", kind: "service", mode: "latest", itemIds: [], limit: 6 },
            { id: uid("contact"), type: "contact_callout", heading: "Questions? Ask a store", text: "", showContactDetails: true },
          ],
        }),
      },
      {
        slug: "about",
        title: "About",
        payload: page({ title: "About", slug: "about", sections: [{ id: uid("about"), type: "rich_text", heading: `About ${siteName}`, body: [] }] }),
      },
      {
        slug: "contact",
        title: "Contact",
        payload: page({
          title: "Contact",
          slug: "contact",
          sections: [
            { id: uid("callout"), type: "contact_callout", heading: "Contact us", text: "", showContactDetails: true },
            { id: uid("form"), type: "inquiry_form", heading: "Send an inquiry", intro: "", locationSelect: true },
          ],
        }),
      },
    ],
  },
};

function page(input: { title: string; slug: string; sections: NonNullable<PagePayloadInput["sections"]> }): PagePayloadInput {
  return {
    schemaVersion: 1,
    title: input.title,
    slug: input.slug,
    summary: "",
    body: [],
    featuredImageAssetId: null,
    metaTitle: "",
    metaDescription: "",
    indexable: true,
    sourceUrl: "",
    lastVerifiedOn: "",
    attribution: "",
    sections: input.sections,
  };
}

export function isPresetKey(value: string): value is PresetKey {
  return value in presets;
}

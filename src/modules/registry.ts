import type { z } from "zod";
import { pagePayloadSchema } from "@/modules/page";
import { placePayloadSchema } from "@/modules/place";
import { eventPayloadSchema } from "@/modules/event";
import { articlePayloadSchema } from "@/modules/article";
import { storePayloadSchema } from "@/modules/store";
import { servicePayloadSchema } from "@/modules/service";
import type { ModuleKey } from "@/modules/site-config";

export const contentKinds = ["page", "place", "event", "article", "store", "service"] as const;
export type ContentKind = (typeof contentKinds)[number];

export interface KindDefinition {
  kind: ContentKind;
  label: string;
  plural: string;
  /** Route prefix for detail pages; pages live at the root. */
  routeBase: string;
  /** Module that must be enabled for this kind to publish (pages always publish). */
  module: ModuleKey | null;
  schema: z.ZodType;
  presets: Array<"community_guide" | "location_business">;
}

export const kindRegistry: Record<ContentKind, KindDefinition> = {
  page: { kind: "page", label: "Page", plural: "Pages", routeBase: "", module: null, schema: pagePayloadSchema, presets: ["community_guide", "location_business"] },
  place: { kind: "place", label: "Place", plural: "Places", routeBase: "/places", module: "places", schema: placePayloadSchema, presets: ["community_guide"] },
  event: { kind: "event", label: "Event", plural: "Events", routeBase: "/events", module: "events", schema: eventPayloadSchema, presets: ["community_guide"] },
  article: { kind: "article", label: "Article", plural: "Articles", routeBase: "/articles", module: "articles", schema: articlePayloadSchema, presets: ["community_guide"] },
  store: { kind: "store", label: "Store", plural: "Stores", routeBase: "/locations", module: "stores", schema: storePayloadSchema, presets: ["location_business"] },
  service: { kind: "service", label: "Service", plural: "Services", routeBase: "/services", module: "services", schema: servicePayloadSchema, presets: ["location_business"] },
};

export function isContentKind(value: string): value is ContentKind {
  return (contentKinds as readonly string[]).includes(value);
}

/** Public route for an item of a kind and slug. Home is the page with slug "home". */
export function routeFor(kind: ContentKind, slug: string): string {
  if (kind === "page") return slug === "home" ? "/" : `/${slug}`;
  return `${kindRegistry[kind].routeBase}/${slug}`;
}

/** Built-in index routes provided by enabled modules. */
export const moduleIndexRoutes: Array<{ module: ModuleKey; path: string; label: string }> = [
  { module: "places", path: "/places", label: "Directory" },
  { module: "events", path: "/events", label: "Events" },
  { module: "articles", path: "/articles", label: "Articles" },
  { module: "stores", path: "/locations", label: "Locations" },
  { module: "services", path: "/services", label: "Services" },
];

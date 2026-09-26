import type { PageSection } from "@/modules/page";
import { resolveCategories, resolveCollection, type CollectionScope } from "@/themes/shared/collections";

/**
 * Whether a section has anything to show a visitor (site-building programme B2, decision
 * D-021). A section with nothing to show is left out of the public page instead of printing
 * a notice such as "No places have been published yet": a fresh site publishes a thin page,
 * never a page of placeholders. Publication validation lists the sections left out, and the
 * editor marks the slots. Themes and the validator share this one rule.
 */
export function sectionHasContent(scope: CollectionScope, section: PageSection): boolean {
  switch (section.type) {
    case "text_hero":
    case "image_hero":
    case "contact_callout":
    case "inquiry_form":
    case "cta_banner":
      return true;
    case "rich_text":
      return section.body.length > 0;
    case "feature_list":
    case "quotes":
    case "facts":
    case "faq":
      return section.items.length > 0;
    case "gallery":
      return section.items.some((it) => Boolean(scope.snapshot.media[it.assetId]));
    case "content_collection":
    case "location_collection":
      return resolveCollection(scope, section).length > 0;
    case "category_list":
      return resolveCategories(scope, section).length > 0;
    case "video":
      return section.videoId.length > 0;
    case "map_link":
      return Boolean(section.address.line1 || section.address.locality);
  }
}

/** The sections of a page that render, in order. */
export function visibleSections(scope: CollectionScope, sections: PageSection[]): PageSection[] {
  return sections.filter((s) => sectionHasContent(scope, s));
}

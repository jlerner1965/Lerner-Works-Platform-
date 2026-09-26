import { kindRegistry, routeFor, type ContentKind } from "@/modules/registry";
import { isExternalLink } from "@/modules/site-config";
import { mapEmbedProviders, sectionTypeLabels, type SectionType } from "@/modules/page";
import { collectLinkTargets, type Block } from "@/lib/richtext";
import { formatRatio } from "@/lib/contrast";
import { failingPairings } from "@/lib/brand-tokens";
import { designCapabilityIssues, resolveDesign, sectionCapabilityIssues, themeCompatibilityIssues, themeKeyFor } from "@/themes/capabilities";
import { sectionHasContent } from "@/themes/shared/empty";
import type { PageSection } from "@/modules/page";
import type { ReleaseSnapshot, SnapshotItem } from "@/server/publishing/snapshot";
import type { BuiltManifest } from "@/server/publishing/manifest";

export interface Finding {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  itemId?: string;
  itemTitle?: string;
  field?: string;
  /** Dashboard link to fix the finding. */
  href: string;
}

export interface ValidationResult {
  blockers: Finding[];
  warnings: Finding[];
}

const MAX_IMAGE_WIDTH = 4000;
const MAX_IMAGE_BYTES = 2_500_000;
const VERIFICATION_STALE_DAYS = 365;
/** Section types made of a list the owner writes by hand: empty ones block publication rather than being left out (B2, D-021). */
const itemListTypes = new Set<string>(["faq", "quotes", "gallery", "facts", "team", "logo_strip", "image_text"]);

/**
 * Validates the entire resulting site, not only edited records. Blockers prevent activation;
 * warnings may be waived with a stored reason.
 */
export function validateManifest(built: BuiltManifest, opts: { now: Date }): ValidationResult {
  const { manifest, mediaRows, missingMedia } = built;
  const siteBase = `/app/sites/${manifest.site.id}`;
  const blockers: Finding[] = [];
  const warnings: Finding[] = [];
  const itemHref = (itemId: string) => `${siteBase}/content/${itemId}`;
  const settingsHref = `${siteBase}/settings`;
  const items = Object.values(manifest.items);
  const routePaths = new Set(manifest.routes.map((r) => r.path));
  const itemById = manifest.items;

  const push = (f: Finding) => (f.severity === "blocker" ? blockers : warnings).push(f);
  const themeKey = themeKeyFor(manifest.site.preset, manifest.config.design);
  const design = resolveDesign(themeKey, manifest.config.design);

  // The chosen theme must be written for the site's preset, and the design options must be ones it offers.
  for (const issue of themeCompatibilityIssues(manifest.site.preset, manifest.config.design)) {
    push({ severity: "blocker", code: "theme_unsupported", message: issue.message, field: issue.path, href: settingsHref });
  }
  for (const issue of designCapabilityIssues(themeKey, manifest.config.design)) {
    push({ severity: "blocker", code: "design_unsupported", message: issue.message, field: issue.path, href: settingsHref });
  }

  // Schema errors and cross-site references.
  for (const item of items) {
    const parsed = kindRegistry[item.kind].schema.safeParse(item.payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues.slice(0, 5)) {
        push({ severity: "blocker", code: "schema", message: `${issue.path.join(".") || "payload"}: ${issue.message}`, itemId: item.id, itemTitle: item.title, field: issue.path.join("."), href: itemHref(item.id) });
      }
    }
  }

  // Required content: a home page.
  const home = items.find((i) => i.kind === "page" && i.slug === "home");
  if (!home) push({ severity: "blocker", code: "missing_home", message: "The site has no published home page (a page with slug \"home\").", href: `${siteBase}/content?kind=page` });

  // Duplicate routes.
  const seen = new Map<string, string>();
  for (const r of manifest.routes) {
    const prev = seen.get(r.path);
    if (prev !== undefined) {
      const item = r.itemId ? itemById[r.itemId] : undefined;
      push({ severity: "blocker", code: "duplicate_route", message: `Route ${r.path} is used more than once (${prev} and ${describeRoute(r, itemById)}).`, itemId: r.itemId, itemTitle: item?.title, field: "slug", href: r.itemId ? itemHref(r.itemId) : settingsHref });
    } else {
      seen.set(r.path, describeRoute(r, itemById));
    }
  }

  // Navigation and footer targets must exist (external https links are rendered as given).
  const cta = manifest.config.navigation.cta;
  const navTargets = [
    ...manifest.config.navigation.items.map((n) => ({ ...n, where: "navigation" })),
    ...manifest.config.footer.links.map((n) => ({ ...n, where: "footer" })),
    ...(cta && cta.label && cta.path ? [{ label: cta.label, path: cta.path, where: "header button" }] : []),
  ];
  for (const n of navTargets) {
    if (isExternalLink(n.path)) continue;
    if (!routePaths.has(normalizePath(n.path))) {
      push({ severity: "blocker", code: "missing_nav_target", message: `${n.where} link "${n.label}" points to ${n.path}, which is not a published route.`, field: n.where, href: settingsHref });
    }
  }

  // Redirect loops and collisions.
  for (const red of manifest.redirects) {
    if (routePaths.has(red.from)) push({ severity: "blocker", code: "redirect_collision", message: `Redirect from ${red.from} collides with a published route.`, href: `${siteBase}/publishing` });
    if (!routePaths.has(red.to)) push({ severity: "blocker", code: "redirect_target_missing", message: `Redirect ${red.from} → ${red.to} points to a missing route.`, href: `${siteBase}/publishing` });
    if (red.from === red.to) push({ severity: "blocker", code: "redirect_loop", message: `Redirect ${red.from} points to itself.`, href: `${siteBase}/publishing` });
  }

  // Links inside bodies and sections; item references; collections; module dependencies.
  for (const item of items) {
    const payload = item.payload;
    const bodies: Array<{ field: string; blocks: Block[] }> = [];
    if (Array.isArray(payload.body)) bodies.push({ field: "body", blocks: payload.body as Block[] });
    if (item.kind === "page") {
      const sections = (payload.sections as Array<Record<string, unknown>>) ?? [];
      // Section types and styles the theme does not render (also refused on save and on import).
      for (const issue of sectionCapabilityIssues(themeKey, sections as Array<{ type: string; variant?: string }>)) {
        push({ severity: "blocker", code: "variant_unsupported", message: issue.message, itemId: item.id, itemTitle: item.title, field: issue.path, href: itemHref(item.id) });
      }
      sections.forEach((s, i) => {
        const type = s.type as string;
        const field = `sections.${i}`;
        const label = sectionTypeLabels[type as SectionType] ?? type;
        if (type === "rich_text" && Array.isArray(s.body)) bodies.push({ field: `${field}.body`, blocks: s.body as Block[] });
        for (const key of ["ctaPath", "secondaryPath"]) {
          const p = s[key];
          if (typeof p === "string" && p && !isExternalLink(p) && !routePaths.has(normalizePath(p))) {
            push({ severity: "blocker", code: "broken_link", message: `Section ${i + 1} links to ${p}, which is not a published route.`, itemId: item.id, itemTitle: item.title, field: `${field}.${key}`, href: itemHref(item.id) });
          }
        }
        if (itemListTypes.has(type) && (!Array.isArray(s.items) || s.items.length === 0)) {
          push({ severity: "blocker", code: "empty_section", message: `Section ${i + 1} (${label}) has no items; add some or remove the section.`, itemId: item.id, itemTitle: item.title, field, href: itemHref(item.id) });
        }
        if (type === "faq") {
          ((s.items as Array<{ answer?: Block[] }>) ?? []).forEach((it, j) => {
            if (Array.isArray(it.answer)) bodies.push({ field: `${field}.items.${j}.answer`, blocks: it.answer });
          });
        }
        if (type === "gallery" || type === "logo_strip" || type === "image_text") {
          const noun = type === "gallery" ? "image" : type === "logo_strip" ? "logo" : "row";
          ((s.items as Array<{ assetId?: string }>) ?? []).forEach((it, j) => {
            if (!it.assetId) push({ severity: "blocker", code: "empty_section", message: `Section ${i + 1} (${label}): ${noun} ${j + 1} has no picture chosen.`, itemId: item.id, itemTitle: item.title, field: `${field}.items.${j}.assetId`, href: itemHref(item.id) });
          });
        }
        // Links carried by list items (B3): a person's page, a logo's site, a row's button.
        if (type === "team" || type === "logo_strip" || type === "image_text") {
          const key = type === "image_text" ? "ctaPath" : "path";
          ((s.items as Array<Record<string, unknown>>) ?? []).forEach((it, j) => {
            const p = it[key];
            if (typeof p === "string" && p && !isExternalLink(p) && !routePaths.has(normalizePath(p))) {
              push({ severity: "blocker", code: "broken_link", message: `Section ${i + 1} (${label}): item ${j + 1} links to ${p}, which is not a published route.`, itemId: item.id, itemTitle: item.title, field: `${field}.items.${j}.${key}`, href: itemHref(item.id) });
            }
            if (type === "image_text" && Array.isArray(it.body)) bodies.push({ field: `${field}.items.${j}.body`, blocks: it.body as Block[] });
          });
        }
        if (type === "image_hero" && s.variant === "collage" && (!Array.isArray(s.extraImageAssetIds) || s.extraImageAssetIds.length === 0)) {
          push({ severity: "warning", code: "hero_collage_short", message: `Section ${i + 1} uses the collage style with a single picture; add up to three more pictures, or choose another style.`, itemId: item.id, itemTitle: item.title, field: `${field}.extraImageAssetIds`, href: itemHref(item.id) });
        }
        if (type === "image_band") {
          if (!s.imageAssetId) push({ severity: "warning", code: "band_no_image", message: `Section ${i + 1} (Photo band) has no picture; it renders as a plain coloured band.`, itemId: item.id, itemTitle: item.title, field: `${field}.imageAssetId`, href: itemHref(item.id) });
          else if (s.strength === "light") push({ severity: "warning", code: "band_wash_light", message: `Section ${i + 1} (Photo band) puts text over its picture with a light wash; readability depends on the picture. Medium or strong is safer.`, itemId: item.id, itemTitle: item.title, field: `${field}.strength`, href: itemHref(item.id) });
        }
        if (type === "cta_banner" && (!s.ctaLabel || !s.ctaPath)) {
          push({ severity: "blocker", code: "cta_incomplete", message: `Section ${i + 1} (Call to action) needs a button label and a link.`, itemId: item.id, itemTitle: item.title, field: `${field}.ctaPath`, href: itemHref(item.id) });
        }
        if (type === "video") {
          if (!s.videoId) push({ severity: "blocker", code: "video_incomplete", message: `Section ${i + 1} (Video) has no video id.`, itemId: item.id, itemTitle: item.title, field: `${field}.videoId`, href: itemHref(item.id) });
          if (!s.title) push({ severity: "blocker", code: "video_incomplete", message: `Section ${i + 1} (Video) needs a title for screen readers and the poster.`, itemId: item.id, itemTitle: item.title, field: `${field}.title`, href: itemHref(item.id) });
          if (!s.posterAssetId) push({ severity: "warning", code: "video_no_poster", message: `Section ${i + 1} (Video) has no poster image; visitors see the title on a plain panel until they press play.`, itemId: item.id, itemTitle: item.title, field: `${field}.posterAssetId`, href: itemHref(item.id) });
        }
        if (type === "image_hero" && s.overlay === "light" && (s.variant === "full" || (s.variant === "default" && design.hero === "full"))) {
          push({ severity: "warning", code: "hero_overlay_light", message: `Section ${i + 1} puts text over its image with a light overlay; readability depends on the picture. Medium or strong is safer.`, itemId: item.id, itemTitle: item.title, field: `${field}.overlay`, href: itemHref(item.id) });
        }
        if (type === "map_link") {
          const a = s.address as { line1?: string; locality?: string; approved?: boolean } | undefined;
          if (!a || (!a.line1 && !a.locality)) push({ severity: "warning", code: "map_no_address", message: `Section ${i + 1} (Map) has no address, so no directions button will appear.`, itemId: item.id, itemTitle: item.title, field: `${field}.address`, href: itemHref(item.id) });
          else if (!a.approved) push({ severity: "warning", code: "map_unapproved", message: `Section ${i + 1} (Map): the address is not approved by the owner, so the directions button and the map stay hidden on the live site.`, itemId: item.id, itemTitle: item.title, field: `${field}.address.approved`, href: itemHref(item.id) });
          // The click-to-load map (B3) needs a provider with a keyless embed and the coordinates to centre it.
          if (s.embed === true) {
            if (!mapEmbedProviders.includes(s.provider as (typeof mapEmbedProviders)[number])) push({ severity: "blocker", code: "map_embed_unsupported", message: `Section ${i + 1} (Map) asks to show a map, but Apple Maps cannot be embedded. Choose Google Maps or OpenStreetMap, or turn the map off and keep the link.`, itemId: item.id, itemTitle: item.title, field: `${field}.provider`, href: itemHref(item.id) });
            if (typeof s.latitude !== "number" || typeof s.longitude !== "number") push({ severity: "blocker", code: "map_embed_incomplete", message: `Section ${i + 1} (Map) asks to show a map but has no latitude and longitude to centre it on.`, itemId: item.id, itemTitle: item.title, field: `${field}.latitude`, href: itemHref(item.id) });
          }
        }
        if (type === "feature_list") {
          for (const [j, fi] of ((s.items as Array<{ path?: string; title?: string }>) ?? []).entries()) {
            if (fi.path && !routePaths.has(normalizePath(fi.path))) {
              push({ severity: "blocker", code: "broken_link", message: `Feature "${fi.title ?? j + 1}" links to ${fi.path}, which is not a published route.`, itemId: item.id, itemTitle: item.title, field: `${field}.items.${j}.path`, href: itemHref(item.id) });
            }
          }
        }
        if (type === "content_collection" || type === "location_collection") {
          const kind: ContentKind = type === "location_collection" ? "store" : (s.kind as ContentKind);
          const mod = kindRegistry[kind]?.module;
          if (mod && !manifest.config.modules[mod]) {
            push({ severity: "blocker", code: "module_disabled_dependency", message: `Section ${i + 1} shows ${kindRegistry[kind].plural.toLowerCase()}, but the ${kindRegistry[kind].plural} module is disabled. Enable the module or remove the section.`, itemId: item.id, itemTitle: item.title, field, href: itemHref(item.id) });
          }
          for (const id of (s.itemIds as string[]) ?? []) {
            const target = itemById[id];
            if (!target) {
              push({ severity: "blocker", code: "missing_reference", message: `Section ${i + 1} references an item that is not part of this release (archived, unpublished or from another site).`, itemId: item.id, itemTitle: item.title, field: `${field}.itemIds`, href: itemHref(item.id) });
            } else if (target.kind !== kind) {
              push({ severity: "blocker", code: "wrong_kind_reference", message: `Section ${i + 1} references "${target.title}", which is a ${target.kind}, not a ${kind}.`, itemId: item.id, itemTitle: item.title, field: `${field}.itemIds`, href: itemHref(item.id) });
            }
          }
        }
        if (type === "category_list" && !manifest.config.modules.places) {
          push({ severity: "blocker", code: "module_disabled_dependency", message: `Section ${i + 1} lists place categories, but the Places module is disabled. Enable the module or remove the section.`, itemId: item.id, itemTitle: item.title, field, href: itemHref(item.id) });
        }
        if (type === "inquiry_form" && !manifest.config.modules.inquiries) {
          push({ severity: "blocker", code: "module_disabled_dependency", message: `Section ${i + 1} is an inquiry form, but the Inquiries module is disabled.`, itemId: item.id, itemTitle: item.title, field, href: itemHref(item.id) });
        }
      });
      // Sections with nothing to show are left out of the public page (B2, D-021); say which, and
      // when a whole page is left empty. The item-list types above already block when empty.
      const parsedPage = kindRegistry.page.schema.safeParse(payload);
      if (parsedPage.success) {
        const parsedSections = (parsedPage.data as { sections: PageSection[] }).sections;
        let shown = 0;
        parsedSections.forEach((s, i) => {
          if (sectionHasContent({ snapshot: manifest, now: opts.now }, s)) {
            shown++;
            return;
          }
          if (itemListTypes.has(s.type)) return;
          const label = sectionTypeLabels[s.type];
          const why = s.type === "rich_text" ? "has no text yet" : s.type === "feature_list" ? "has no items yet" : s.type === "content_collection" || s.type === "location_collection" ? (s.mode === "selected" ? "has no items chosen" : `has no published ${s.type === "location_collection" ? "stores" : kindRegistry[s.kind].plural.toLowerCase()} to show yet`) : s.type === "category_list" ? "has no published places with a category yet" : s.type === "video" ? "has no video yet" : s.type === "image_band" ? "has no heading, text or picture yet" : "has no address yet";
          push({ severity: "warning", code: "section_left_out", message: `Section ${i + 1} (${label}) ${why}; it is left out of the page until it does.`, itemId: item.id, itemTitle: item.title, field: `sections.${i}`, href: itemHref(item.id) });
        });
        if (parsedSections.length > 0 && shown === 0) {
          push({ severity: "warning", code: "page_empty", message: `"${item.title}" has nothing to show yet: every section is left out, so visitors see an empty page.`, itemId: item.id, itemTitle: item.title, field: "sections", href: itemHref(item.id) });
        }
      }
    }
    if (item.kind === "event") {
      const venue = payload.venueItemId as string | null;
      if (venue && !itemById[venue]) push({ severity: "blocker", code: "missing_reference", message: "The venue references a place that is not part of this release.", itemId: item.id, itemTitle: item.title, field: "venueItemId", href: itemHref(item.id) });
    }
    if (item.kind === "store") {
      for (const sid of (payload.serviceItemIds as string[]) ?? []) {
        if (!itemById[sid]) push({ severity: "blocker", code: "missing_reference", message: "A listed service is not part of this release (archived or unpublished).", itemId: item.id, itemTitle: item.title, field: "serviceItemIds", href: itemHref(item.id) });
      }
      if (payload.weeklyHours === null) push({ severity: "warning", code: "hours_unknown", message: "Weekly hours are unknown; visitors will see \"Hours not published\".", itemId: item.id, itemTitle: item.title, field: "weeklyHours", href: itemHref(item.id) });
    }
    for (const body of bodies) {
      for (const target of collectLinkTargets(body.blocks)) {
        if (target.startsWith("item:")) {
          if (!itemById[target.slice(5)]) push({ severity: "blocker", code: "broken_link", message: `A link references an item that is not part of this release.`, itemId: item.id, itemTitle: item.title, field: body.field, href: itemHref(item.id) });
        } else if (target.startsWith("/")) {
          if (!routePaths.has(normalizePath(target.split(/[?#]/)[0] ?? target))) push({ severity: "blocker", code: "broken_link", message: `A link points to ${target}, which is not a published route.`, itemId: item.id, itemTitle: item.title, field: body.field, href: itemHref(item.id) });
        } else if (!/^https:\/\//i.test(target)) {
          push({ severity: "blocker", code: "unsafe_link", message: `A link uses an unsupported target (${target.slice(0, 40)}). Only same-site paths, item references and https URLs are allowed.`, itemId: item.id, itemTitle: item.title, field: body.field, href: itemHref(item.id) });
        }
      }
    }

    // Metadata and freshness warnings.
    if (!(payload.metaDescription as string) && !(payload.summary as string)) {
      push({ severity: "warning", code: "missing_description", message: "No summary or meta description; search engines and listings will show nothing.", itemId: item.id, itemTitle: item.title, field: "summary", href: itemHref(item.id) });
    } else if (typeof payload.summary === "string" && payload.summary.length > 0 && payload.summary.length < 40) {
      push({ severity: "warning", code: "short_description", message: "The summary is very short (under 40 characters).", itemId: item.id, itemTitle: item.title, field: "summary", href: itemHref(item.id) });
    }
    if ((item.kind === "place" || item.kind === "store") && typeof payload.lastVerifiedOn === "string" && payload.lastVerifiedOn) {
      const ageDays = (opts.now.getTime() - Date.parse(payload.lastVerifiedOn)) / 86_400_000;
      if (ageDays > VERIFICATION_STALE_DAYS) push({ severity: "warning", code: "stale_verification", message: `Last verified ${Math.floor(ageDays)} days ago.`, itemId: item.id, itemTitle: item.title, field: "lastVerifiedOn", href: itemHref(item.id) });
    }
  }

  // Media: missing/withdrawn assets, required alternative text, licensing, oversized images.
  for (const m of missingMedia) {
    const item = m.itemId ? itemById[m.itemId] : undefined;
    const row = mediaRows.get(m.assetId);
    const why = !row ? "does not exist in this site" : row.status === "withdrawn" ? "was withdrawn" : "is still processing";
    push({ severity: "blocker", code: "missing_media", message: `A referenced image ${why}.`, itemId: m.itemId ?? undefined, itemTitle: item?.title, field: m.field, href: m.itemId ? itemHref(m.itemId) : settingsHref });
  }
  for (const media of Object.values(manifest.media)) {
    const href = `${siteBase}/media/${media.id}`;
    if (!media.decorative && !media.alt.trim()) push({ severity: "blocker", code: "missing_alt", message: `Image "${media.title || media.id.slice(0, 8)}" has no alternative text and is not marked decorative.`, field: "altText", href });
    if (!media.license.trim()) push({ severity: "blocker", code: "unlicensed_asset", message: `Image "${media.title || media.id.slice(0, 8)}" has no recorded license or rights statement.`, field: "license", href });
    const w1600 = media.variants.w1600;
    if (media.width > MAX_IMAGE_WIDTH || (w1600 && w1600.bytes > MAX_IMAGE_BYTES)) push({ severity: "warning", code: "large_image", message: `Image "${media.title || media.id.slice(0, 8)}" is unusually large (${media.width}px wide).`, href });
  }

  // Brand contrast: every pairing the themes render, from the four colours and the tokens
  // derived from them, with the owner's overrides applied (WCAG 2.2 AA: 4.5:1 for text,
  // 3:1 for focus rings and field borders).
  for (const p of failingPairings(manifest.config.branding.colors, manifest.config.design?.overrides ?? {})) {
    push({ severity: "blocker", code: "contrast", message: `Brand colors fail contrast: ${p.label} (${p.fg} on ${p.bg}) reads at ${formatRatio(p.ratio)}; the minimum is ${p.minimum}:1.`, field: "branding.colors", href: settingsHref });
  }
  if (!manifest.config.metadata.defaultDescription) push({ severity: "warning", code: "missing_site_description", message: "The site has no default description for search results.", field: "metadata.defaultDescription", href: settingsHref });

  return { blockers, warnings };
}

function normalizePath(p: string): string {
  const s = p.split(/[?#]/)[0] ?? "";
  if (s.length > 1 && s.endsWith("/")) return s.slice(0, -1);
  return s || "/";
}

function describeRoute(r: ReleaseSnapshot["routes"][number], items: Record<string, SnapshotItem>): string {
  if (r.itemId) {
    const it = items[r.itemId];
    return it ? `${it.kind} "${it.title}"` : r.itemId;
  }
  return r.kind === "index" ? `${r.module} index` : r.kind;
}

/** Route path for an item in a manifest (helper for UI). */
export function manifestRouteFor(item: SnapshotItem): string {
  return routeFor(item.kind, item.slug);
}

import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import type { Db } from "@/server/data/db";
import type { SiteRow } from "@/server/data/access";
import { presets, type PresetKey } from "@/modules/presets";
import { kindRegistry } from "@/modules/registry";
import { siteConfigSchema, typographyPresetKeys, type SiteConfig } from "@/modules/site-config";
import { csvSpecs, templateCsv, type ImportableKind } from "@/server/import/csv-spec";
import { parseCsv, autoMap, dryRun, applyImport, type DryRunResult, type DryRunRow } from "@/server/import/csv";
import { ingestImage, sniffImageType, MAX_UPLOAD_BYTES } from "@/server/media/ingest";
import { getCurrentSiteConfig, saveSiteConfig } from "@/server/data/sites";
import { getItem, saveRevision, approveOnSave, validatePayload } from "@/server/data/content";
import { parseStructuredText } from "@/lib/richtext";
import { failingPairings } from "@/lib/brand-tokens";
import { formatRatio } from "@/lib/contrast";
import { capabilitiesFor } from "@/themes/capabilities";

/**
 * The onboarding package (site-building programme B2-2): a ZIP a client or the agency fills
 * in once to take a fresh site to its first release. One spreadsheet per content kind of the
 * preset (the CSV templates of the import page, with a featured-image column), a settings
 * sheet (`site.csv`, key/value rows for the brand, contact details and the starter pages'
 * text) and an `images/` folder listed in `images.csv` with alternative text and rights.
 * It is imported through the same dry-run-then-confirm step as a CSV file: the dry run
 * validates every sheet, image and setting and writes nothing; confirming applies all of it
 * in one transaction, approved on save when the importer may publish and the site does not
 * require review.
 */
export const MAX_ONBOARDING_BYTES = 64 * 1024 * 1024;
const MAX_UNCOMPRESSED = 256 * 1024 * 1024;
const MAX_IMAGES = 100;
const MAX_FILES = 250;

const kindFiles: Record<ImportableKind, string> = { place: "places.csv", event: "events.csv", article: "articles.csv", service: "services.csv", store: "stores.csv" };
/** Import order per preset: services before the stores that refer to them; places before events. */
const kindOrder: Record<PresetKey, ImportableKind[]> = { community_guide: ["place", "event", "article"], location_business: ["service", "store"] };
const IMAGE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(jpe?g|png|webp)$/i;
const HEX = /^#[0-9a-fA-F]{6}$/;

export interface SiteSheetKey {
  key: string;
  description: string;
  example: string;
}

export const siteSheetKeys: SiteSheetKey[] = [
  { key: "wordmark", description: "The name shown in the header and footer (up to 60 characters); the site name unless a shorter form reads better.", example: "Cedar Bend Guide" },
  { key: "tagline", description: "A line under the name in the header (up to 120 characters).", example: "Shops, trails and the people who keep the town going" },
  { key: "description", description: "The site's description for search results (up to 200 characters).", example: "A guide to Cedar Bend's shops, trails and events, kept by the people who live here." },
  { key: "contact_email", description: "The public contact email shown in the footer and callouts.", example: "hello@cedarbend.example" },
  { key: "contact_phone", description: "The public phone number.", example: "(303) 555-0100" },
  { key: "contact_address", description: "The public postal address (use \\n for line breaks).", example: "12 Main Street, Cedar Bend, CO 80999" },
  { key: "primary_color", description: "Headings, links and buttons: a 6-digit hex colour such as #1f4e3d. Every colour pairing is checked for readability at publication.", example: "#1f4e3d" },
  { key: "accent_color", description: "Accents and secondary buttons, 6-digit hex.", example: "#8a3b12" },
  { key: "background_color", description: "Page background, 6-digit hex.", example: "#f7f4ec" },
  { key: "text_color", description: "Body text, 6-digit hex.", example: "#25302a" },
  { key: "typography", description: `The type pairing: one of ${typographyPresetKeys.join(", ")}.`, example: "editorial-serif" },
  { key: "logo", description: "File name in images/ of the logo (a wide image with a transparent background works best); shown instead of the wordmark.", example: "logo.png" },
  { key: "share_image", description: "File name in images/ of the picture shown when a page of the site is shared.", example: "share.jpg" },
  { key: "hero_image", description: "File name in images/ of the home page's opening picture (a home that opens with words alone opens with the picture instead).", example: "hero.jpg" },
  { key: "home_subheading", description: "The sentence under the home page heading (up to 400 characters).", example: "Everything worth knowing about Cedar Bend, in one place." },
  { key: "home_intro", description: "The home page introduction: paragraphs separated by a blank line.", example: "" },
  { key: "about_text", description: "The About page text: paragraphs separated by a blank line; \"## \" starts a heading, \"- \" a list item.", example: "" },
];

const imagesSheetColumns = ["file", "alt_text", "title", "license", "attribution", "source_url", "decorative"] as const;

/** The downloadable template for a preset: sheets with headers and one example row, the settings sheet with every key explained, an images folder. */
export function buildOnboardingTemplate(preset: PresetKey, siteName: string): Uint8Array {
  const def = presets[preset];
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const files: Record<string, Uint8Array> = {};
  const kinds = kindOrder[preset];
  const readme = `# Onboarding package for ${siteName} (${def.label})

Fill in these sheets, drop the pictures into images/, zip the folder again and upload it on
the site's Import & export page. The upload runs a dry run first: every row, image and setting
is checked and nothing is written until you confirm. Rows with errors are listed and skipped.

## Sheets
${kinds.map((k) => `- ${kindFiles[k]} — one row per ${kindRegistry[k].label.toLowerCase()}. The first row names the columns; the second is an example to replace. Required: ${csvSpecs[k].filter((c) => c.required).map((c) => c.key).join(", ")}.`).join("\n")}
- site.csv — the brand, contact details and the starter pages' text as key/value rows. Leave a value empty to keep the site's current setting. The notes column explains each key and is ignored.
- images.csv — one row per file in images/: alternative text (what the picture shows, for people who cannot see it), title, license or rights statement, attribution, source. Publication needs alternative text (or "decorative" = yes) and a license for every image.

## Images
JPEG, PNG or WebP, up to 10 MB each, up to ${MAX_IMAGES} files, named with letters, numbers, dots, hyphens or underscores. A row's "image" column names the file that becomes its featured image. Originals stay private; published derivatives are public.

## Text
The "body" columns and the home_intro / about_text settings hold plain text: paragraphs separated by a blank line, "## " at the start of a line for a heading, "- " for a list item, **bold** and *italic* inline. No HTML.

## Time and dates
Dates are YYYY-MM-DD. Event times are YYYY-MM-DD HH:MM in the site's time zone (${def.defaultTimeZone} unless a time_zone column says otherwise).
`;
  files["README.md"] = strToU8(readme);
  files["site.csv"] = strToU8(["key,value,notes", ...siteSheetKeys.map((k) => [k.key, "", `${k.description} Example: ${k.example}`].map(esc).join(","))].join("\r\n") + "\r\n");
  for (const k of kinds) files[kindFiles[k]] = strToU8(templateCsv(k));
  files["images.csv"] = strToU8([imagesSheetColumns.join(","), ["storefront.jpg", "The bakery's front window at dawn, bread stacked on the counter", "Bakery storefront", "Owned by the client", "", "", "no"].map(esc).join(",")].join("\r\n") + "\r\n");
  files["images/README.txt"] = strToU8("Put the image files here and list each one in images.csv (file, alternative text, title, license, attribution, source URL, decorative).\r\n");
  return zipSync(files, { level: 6 });
}

export interface OnboardingImage {
  file: string;
  bytes: number;
  title: string;
  alt: string;
  decorative: boolean;
  license: string;
  attribution: string;
  sourceUrl: string;
}

export interface OnboardingKindResult {
  kind: ImportableKind;
  file: string;
  headers: string[];
  counts: DryRunResult["counts"];
  rows: DryRunRow[];
}

/** What the dry run found; the JSON-safe part is stored on the import job and shown on its page. */
export interface OnboardingDryRun {
  errors: string[];
  warnings: string[];
  kinds: OnboardingKindResult[];
  images: OnboardingImage[];
  settings: { values: Record<string, string>; problems: string[] };
  summary: { items: number; images: number; settings: number; rowErrors: number };
  /** Full per-kind results (payloads) and image bytes; not stored, recomputed from the package when confirming. */
  results: Partial<Record<ImportableKind, DryRunResult>>;
  files: Record<string, Uint8Array>;
}

export function onboardingJobSummary(dry: OnboardingDryRun): Omit<OnboardingDryRun, "results" | "files"> {
  const { errors, warnings, kinds, images, settings, summary } = dry;
  return { errors, warnings, kinds, images, settings, summary };
}

const truthy = (v: string) => /^(yes|true|1|y)$/i.test(v.trim());

/** Validates a package without writing anything: files, sheets, images and settings. */
export async function dryRunOnboarding(db: Db, site: SiteRow, bytes: Uint8Array, opts: { canApplySettings: boolean }): Promise<OnboardingDryRun> {
  const out: OnboardingDryRun = { errors: [], warnings: [], kinds: [], images: [], settings: { values: {}, problems: [] }, summary: { items: 0, images: 0, settings: 0, rowErrors: 0 }, results: {}, files: {} };
  if (bytes.byteLength > MAX_ONBOARDING_BYTES) {
    out.errors.push("The package is larger than 64 MB.");
    return out;
  }
  let entries: Record<string, Uint8Array>;
  try {
    let total = 0;
    entries = unzipSync(bytes, {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_UNCOMPRESSED) throw new Error("uncompressed size exceeds 256 MB");
        return true;
      },
    });
  } catch (err) {
    out.errors.push(`The file is not a valid package: ${(err as Error).message}`);
    return out;
  }
  // Folders and macOS resource forks are ignored; a package zipped with its folder as the root is accepted.
  const raw = Object.entries(entries).filter(([p]) => !p.endsWith("/") && !p.includes("__MACOSX") && !p.split("/").some((seg) => seg.startsWith(".")));
  const roots = new Set(raw.map(([p]) => p.split("/")[0]));
  const prefix = raw.length && roots.size === 1 && !raw.some(([p]) => !p.includes("/")) ? `${[...roots][0]}/` : "";
  const files = new Map(raw.map(([p, data]) => [p.startsWith(prefix) ? p.slice(prefix.length) : p, data]));
  if (files.size > MAX_FILES) out.errors.push(`The package has ${files.size} files; the limit is ${MAX_FILES}.`);
  const kinds = kindOrder[site.preset];
  const known = new Set(["README.md", "site.csv", "images.csv", "images/README.txt", ...kinds.map((k) => kindFiles[k])]);
  const imageFiles = new Map<string, Uint8Array>();
  for (const [p, data] of files) {
    if (known.has(p)) continue;
    if (p.startsWith("images/")) {
      const name = p.slice(7);
      if (!IMAGE_NAME.test(name)) out.errors.push(`images/${name}: use a file name with letters, numbers, dots, hyphens or underscores and a .jpg, .png or .webp ending.`);
      else imageFiles.set(name, data);
      continue;
    }
    out.errors.push(`Unexpected file in package: ${p}${Object.values(kindFiles).includes(p) ? ` (not a content kind of the ${presets[site.preset].label} preset)` : ""}`);
  }
  if (imageFiles.size > MAX_IMAGES) out.errors.push(`The package has ${imageFiles.size} images; the limit is ${MAX_IMAGES}.`);
  if (out.errors.length) return out;

  // Images: real type by signature, size, and the metadata sheet.
  const meta = new Map<string, Record<string, string>>();
  const imagesSheet = files.get("images.csv");
  if (imagesSheet) {
    try {
      const parsed = parseCsv(strFromU8(imagesSheet));
      for (const row of parsed.rows) {
        const file = (row.file ?? "").trim();
        if (!file) continue;
        if (!imageFiles.has(file)) out.warnings.push(`images.csv lists "${file}", which is not in the images folder; the row is ignored.`);
        else meta.set(file, row);
      }
    } catch (err) {
      out.errors.push(`images.csv could not be read: ${(err as Error).message}`);
    }
  }
  for (const [file, data] of [...imageFiles].sort(([a], [b]) => a.localeCompare(b))) {
    const type = sniffImageType(data);
    if (data.byteLength > MAX_UPLOAD_BYTES) out.errors.push(`images/${file} is larger than 10 MB.`);
    if (!type || type === "image/svg+xml" || type === "image/avif" || type === "image/gif") out.errors.push(`images/${file} is not a JPEG, PNG or WebP image.`);
    const m = meta.get(file) ?? {};
    out.images.push({ file, bytes: data.byteLength, title: (m.title ?? "").trim().slice(0, 200) || file.replace(/\.[a-z0-9]+$/i, ""), alt: (m.alt_text ?? "").trim().slice(0, 500), decorative: truthy(m.decorative ?? ""), license: (m.license ?? "").trim().slice(0, 200), attribution: (m.attribution ?? "").trim().slice(0, 500), sourceUrl: (m.source_url ?? "").trim().slice(0, 1000) });
    out.files[file] = data;
  }

  // Content sheets, in import order, with the package's own images and services available to rows.
  const pendingServices = new Set<string>();
  for (const kind of kinds) {
    const file = kindFiles[kind];
    const data = files.get(file);
    if (!data) continue;
    let parsed;
    try {
      parsed = parseCsv(strFromU8(data));
    } catch (err) {
      out.errors.push(`${file} could not be read: ${(err as Error).message}`);
      continue;
    }
    const mapping = autoMap(kind, parsed.headers);
    const result = await dryRun(db, site, kind, parsed, mapping, { imageFiles: new Set(imageFiles.keys()), pendingServices: kind === "store" ? pendingServices : undefined });
    if (kind === "service") for (const row of result.rows) if (row.action === "create" || row.action === "update") pendingServices.add(String(result.valid[row.externalId]?.slug ?? ""));
    out.results[kind] = result;
    out.kinds.push({ kind, file, headers: parsed.headers, counts: result.counts, rows: result.rows });
    out.summary.items += result.counts.create + result.counts.update;
    out.summary.rowErrors += result.counts.error;
    // A row's image_alt fills in for images.csv.
    for (const row of result.rows) {
      if (!row.image || !row.imageAlt) continue;
      const img = out.images.find((i) => i.file === row.image);
      if (img && !img.alt) img.alt = row.imageAlt.slice(0, 500);
    }
  }
  for (const img of out.images) {
    if (!img.alt && !img.decorative) out.warnings.push(`images/${img.file} has no alternative text yet; add it in images.csv (alt_text), in the row's image_alt column, or in Media after the import. Publication needs it.`);
    if (!img.license) out.warnings.push(`images/${img.file} has no license or rights statement; add it in images.csv (license) or in Media after the import. Publication needs it.`);
  }
  out.summary.images = out.images.length;

  // Settings sheet.
  const sheet = files.get("site.csv");
  if (sheet) {
    try {
      const parsed = parseCsv(strFromU8(sheet));
      const allowed = new Set(siteSheetKeys.map((k) => k.key));
      for (const row of parsed.rows) {
        const key = (row.key ?? "").trim();
        const value = (row.value ?? "").trim();
        if (!key || !value) continue;
        if (!allowed.has(key)) {
          out.warnings.push(`site.csv: "${key}" is not a setting; it is ignored.`);
          continue;
        }
        out.settings.values[key] = value;
      }
    } catch (err) {
      out.errors.push(`site.csv could not be read: ${(err as Error).message}`);
    }
    const v = out.settings.values;
    for (const k of ["primary_color", "accent_color", "background_color", "text_color"]) if (v[k] && !HEX.test(v[k])) out.settings.problems.push(`${k}: use a 6-digit hex colour such as #1f4e3d.`);
    if (v.typography && !(typographyPresetKeys as readonly string[]).includes(v.typography)) out.settings.problems.push(`typography: use one of ${typographyPresetKeys.join(", ")}.`);
    if (v.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contact_email)) out.settings.problems.push("contact_email: enter a valid email address.");
    for (const k of ["logo", "share_image", "hero_image"]) if (v[k] && !imageFiles.has(v[k])) out.settings.problems.push(`${k}: no file named "${v[k]}" in the images folder.`);
    if (v.wordmark && v.wordmark.length > 60) out.settings.problems.push("wordmark: at most 60 characters.");
    if (v.tagline && v.tagline.length > 120) out.settings.problems.push("tagline: at most 120 characters.");
    if (v.description && v.description.length > 200) out.settings.problems.push("description: at most 200 characters.");
    if (v.home_subheading && v.home_subheading.length > 400) out.settings.problems.push("home_subheading: at most 400 characters.");
    // The colours the sheet would leave the site with are checked against every pairing the
    // compositions render, as publication checks them, so the client fixes the sheet rather
    // than finding the first release blocked.
    const colourKeys = { primary_color: "primary", accent_color: "accent", background_color: "background", text_color: "text" } as const;
    if (Object.keys(colourKeys).some((k) => v[k] && HEX.test(v[k]))) {
      const current = await getCurrentSiteConfig(db, site.id);
      if (current) {
        const colors = { ...current.config.branding.colors };
        for (const [k, c] of Object.entries(colourKeys)) if (v[k] && HEX.test(v[k])) colors[c] = v[k].toLowerCase();
        for (const p of failingPairings(colors, current.config.design.overrides)) out.settings.problems.push(`colours: ${p.label} (${p.fg} on ${p.bg}) reads at ${formatRatio(p.ratio)}; the minimum is ${p.minimum}:1, so publication would be blocked. Choose a darker or lighter colour.`);
      }
    }
    out.errors.push(...out.settings.problems.map((p) => `site.csv: ${p}`));
    out.summary.settings = Object.keys(v).length;
    if (out.summary.settings && !opts.canApplySettings) out.warnings.push("The settings sheet (brand, contact details, page text) needs an organization owner; a publisher's or editor's import brings the content and images only.");
  }
  if (out.summary.items === 0 && out.summary.images === 0 && out.summary.settings === 0 && out.errors.length === 0) out.warnings.push("The package has nothing to import: no rows, images or settings.");
  return out;
}

export interface OnboardingApplied {
  created: number;
  updated: number;
  skipped: number;
  images: number;
  /** Setting keys applied from the sheet. */
  settings: string[];
  /** Starter pages given text or a picture from the sheet. */
  pages: string[];
  approved: boolean;
}

/** Applies a validated package in the caller's transaction: images, then content in import order, then the settings sheet. */
export async function applyOnboarding(db: Db, site: SiteRow, userId: string, dry: OnboardingDryRun, opts: { approve: boolean; applySettings: boolean }): Promise<OnboardingApplied> {
  if (dry.errors.length) throw new Error("package has validation errors");
  const assets = new Map<string, string>();
  for (const img of dry.images) {
    const data = dry.files[img.file];
    if (!data) throw new Error(`image ${img.file} is missing from the package`);
    const result = await ingestImage(db, { siteId: site.id, organizationId: site.organizationId, userId, bytes: data, filename: img.file, declaredMime: "", title: img.title, altText: img.alt, decorative: img.decorative, attributionText: img.attribution, license: img.license, sourceUrl: img.sourceUrl });
    if (!result.ok) throw new Error(`images/${img.file}: ${result.error}`);
    assets.set(img.file, result.asset.id);
  }
  const totals = { created: 0, updated: 0, skipped: 0 };
  let serviceIds = new Map<string, string>();
  for (const kind of kindOrder[site.preset]) {
    const result = dry.results[kind];
    if (!result) continue;
    if (kind === "store") {
      serviceIds = new Map((await db<{ id: string; slug: string }[]>`select i.id, r.slug from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${site.id} and i.kind = 'service' and i.archived_at is null`).map((s) => [s.slug, s.id]));
    }
    const applied = await applyImport(db, site, kind, userId, result, { approve: opts.approve, imageAssets: assets, serviceIds });
    totals.created += applied.created;
    totals.updated += applied.updated;
    totals.skipped += applied.skipped;
  }
  const settings: string[] = [];
  const pages: string[] = [];
  const v = dry.settings.values;
  if (opts.applySettings && Object.keys(v).length) {
    const current = await getCurrentSiteConfig(db, site.id);
    if (current) {
      const config = structuredClone(current.config) as SiteConfig;
      const set = (key: string, apply: () => void) => {
        if (v[key] === undefined) return;
        apply();
        settings.push(key);
      };
      set("wordmark", () => (config.branding.wordmark = v.wordmark!));
      set("tagline", () => (config.branding.tagline = v.tagline!));
      set("description", () => (config.metadata.defaultDescription = v.description!));
      set("primary_color", () => (config.branding.colors.primary = v.primary_color!.toLowerCase()));
      set("accent_color", () => (config.branding.colors.accent = v.accent_color!.toLowerCase()));
      set("background_color", () => (config.branding.colors.background = v.background_color!.toLowerCase()));
      set("text_color", () => (config.branding.colors.text = v.text_color!.toLowerCase()));
      set("typography", () => (config.branding.typography = v.typography as SiteConfig["branding"]["typography"]));
      set("logo", () => (config.branding.logoAssetId = assets.get(v.logo!) ?? null));
      set("share_image", () => (config.metadata.shareImageAssetId = assets.get(v.share_image!) ?? null));
      if (settings.length) {
        const parsed = siteConfigSchema.parse(config);
        const saved = await saveSiteConfig(db, { siteId: site.id, organizationId: site.organizationId, baseRevisionId: current.id, config: parsed, authorId: userId, changeNote: "Onboarding package" });
        if (!saved.ok) throw new Error("the site configuration changed during the import; nothing was written");
      }
    }
    const contactKeys = ["contact_email", "contact_phone", "contact_address"].filter((k) => v[k] !== undefined);
    if (contactKeys.length) {
      await db`update public.sites set
        contact_email = ${v.contact_email ?? site.contactEmail},
        contact_phone = ${(v.contact_phone ?? site.contactPhone ?? "").slice(0, 40) || null},
        contact_address = ${(v.contact_address ?? site.contactAddress ?? "").replace(/\\n/g, "\n").slice(0, 300) || null}
        where id = ${site.id}`;
      await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata)
        values (${site.organizationId}, ${site.id}, ${userId}, 'site.contact_updated', 'site', ${site.id}, ${db.json({ source: "onboarding_package", keys: contactKeys })})`;
      settings.push(...contactKeys);
    }
    // Starter pages: the home hero's picture and subheading, the home introduction, the About text.
    const pageKeys = ["hero_image", "home_subheading", "home_intro", "about_text"].filter((k) => v[k] !== undefined);
    if (pageKeys.length) {
      const starters = await db<{ id: string; slug: string }[]>`select i.id, r.slug from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${site.id} and i.kind = 'page' and r.slug in ('home', 'about') and i.archived_at is null`;
      // Home before About, whatever order the rows come back in.
      starters.sort((a, b) => (a.slug === "home" ? -1 : b.slug === "home" ? 1 : 0));
      for (const p of starters) {
        const current = await getItem(db, p.id);
        if (!current) continue;
        const sections = structuredClone((current.revision.payload.sections as Array<Record<string, unknown>>) ?? []);
        let changed = false;
        if (p.slug === "home") {
          const heroIndex = sections.findIndex((s) => s.type === "image_hero" || s.type === "text_hero");
          const hero = heroIndex >= 0 ? sections[heroIndex] : undefined;
          if (hero && v.home_subheading !== undefined) {
            hero.subheading = v.home_subheading;
            changed = true;
          }
          if (hero && v.hero_image !== undefined && assets.get(v.hero_image)) {
            if (hero.type === "image_hero") {
              hero.imageAssetId = assets.get(v.hero_image);
              changed = true;
            } else if (capabilitiesFor(site.preset, (await getCurrentSiteConfig(db, site.id))?.config.design).sectionTypes.includes("image_hero")) {
              // A starter home that opens with words alone (the location business) opens with the picture instead, keeping its words and button.
              sections[heroIndex] = { id: hero.id, type: "image_hero", heading: hero.heading, subheading: hero.subheading, imageAssetId: assets.get(v.hero_image), ctaLabel: hero.ctaLabel, ctaPath: hero.ctaPath, appearance: hero.appearance };
              changed = true;
            }
          }
          const intro = sections.find((s) => s.type === "rich_text");
          if (intro && v.home_intro !== undefined) {
            intro.body = parseStructuredText(v.home_intro);
            changed = true;
          }
        }
        if (p.slug === "about" && v.about_text !== undefined) {
          const text = sections.find((s) => s.type === "rich_text");
          if (text) {
            text.body = parseStructuredText(v.about_text);
            changed = true;
          }
        }
        if (!changed) continue;
        const payload = validatePayload("page", { ...current.revision.payload, sections });
        const saved = await saveRevision(db, { itemId: p.id, baseRevisionId: current.revision.id, payload, authorId: userId, changeNote: "Onboarding package" });
        if (!saved.ok) throw new Error(`the ${p.slug} page changed during the import; nothing was written`);
        if (opts.approve) await approveOnSave(db, { item: { id: p.id, organizationId: site.organizationId, siteId: site.id }, revisionId: saved.revision.id, actorId: userId });
        pages.push(p.slug);
      }
      settings.push(...pageKeys.filter((k) => (k === "about_text" ? pages.includes("about") : pages.includes("home"))));
    }
  }
  return { ...totals, images: assets.size, settings, pages, approved: opts.approve };
}

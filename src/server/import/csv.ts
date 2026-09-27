import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import type { Db } from "@/server/data/db";
import type { SiteRow } from "@/server/data/access";
import { csvSpecs, type ImportableKind } from "@/server/import/csv-spec";
import { validatePayload, createContentItem, saveRevision, getItem, approveOnSave, ContentValidationError } from "@/server/data/content";
import { slugify } from "@/lib/slug";
import { parseStructuredText } from "@/lib/richtext";
import type { HoursInterval, WeeklyHours } from "@/modules/common";
import { fromLocalInput } from "@/lib/local-time";

export const MAX_ROWS = 500;
export const MAX_BYTES = 5 * 1024 * 1024;

export type Mapping = Record<string, string>; // target column key -> source header ("" = unmapped)

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  sha256: string;
}

export function parseCsv(text: string): ParsedCsv {
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("The file is larger than 5 MB. Split it into smaller files.");
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true }) as Record<string, string>[];
  if (records.length > MAX_ROWS) throw new Error(`The file has ${records.length} rows; the limit is ${MAX_ROWS}. Split it into smaller files.`);
  const headers = records.length ? Object.keys(records[0]!) : (parse(text, { to_line: 1, bom: true, trim: true }) as string[][])[0] ?? [];
  return { headers, rows: records, sha256: createHash("sha256").update(text).digest("hex") };
}

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Suggests a mapping by matching normalized headers to column keys. */
export function autoMap(kind: ImportableKind, headers: string[]): Mapping {
  const mapping: Mapping = {};
  const normalized = new Map(headers.map((h) => [normalizeHeader(h), h]));
  for (const col of csvSpecs[kind]) mapping[col.key] = normalized.get(col.key) ?? "";
  return mapping;
}

function parseIntervals(raw: string): { intervals: HoursInterval[] } | "unknown" | null {
  const v = raw.trim().toLowerCase();
  if (v === "unknown") return "unknown";
  if (!v || v === "closed") return { intervals: [] };
  const intervals: HoursInterval[] = [];
  for (const part of v.split(";")) {
    const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(part.trim());
    if (!m) return null;
    const open = `${m[1]!.padStart(2, "0")}:${m[2]}`;
    const close = `${m[3]!.padStart(2, "0")}:${m[4]}`;
    intervals.push({ open, close, closesNextDay: close <= open });
  }
  return { intervals };
}

function hoursFromRow(get: (k: string) => string): { value: WeeklyHours | null; error?: string } {
  const week: WeeklyHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
  let any = false;
  for (const d of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) {
    const raw = get(`hours_${d}`);
    if (raw) any = true;
    const parsed = parseIntervals(raw);
    if (parsed === null) return { value: null, error: `hours_${d}: use HH:MM-HH:MM, "closed" or "unknown"` };
    if (parsed === "unknown") return { value: null };
    week[d] = parsed.intervals;
  }
  return { value: any ? week : null };
}

function instantFromCell(raw: string, timeZone: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})$/.test(v)) return new Date(v.replace(" ", "T")).toISOString();
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})$/.exec(v);
  if (m) return fromLocalInput(`${m[1]}T${m[2]}`, timeZone) || null;
  return null;
}

/** Converts one CSV row into a content payload for the kind. The featured image and the attachments, if any, are named by file for the onboarding package to resolve. */
export function rowToPayload(kind: ImportableKind, row: Record<string, string>, mapping: Mapping, site: { timeZone: string }, services: Map<string, string>): { payload?: Record<string, unknown>; errors: string[]; image: string; imageAlt: string; attachments: string[] } {
  const get = (key: string) => (mapping[key] ? (row[mapping[key]!] ?? "").trim() : "");
  const errors: string[] = [];
  const title = get("title");
  const slug = get("slug") ? slugify(get("slug")) : slugify(title);
  const image = get("image");
  const imageAlt = get("image_alt");
  const attachments = [...new Set(get("attachments").split(";").map((s) => s.trim()).filter(Boolean))];
  const base = { schemaVersion: 1, title, slug, summary: get("summary"), body: parseStructuredText(get("body")), featuredImageAssetId: null, attachments: [], metaTitle: "", metaDescription: "", indexable: true, sourceUrl: get("source_url"), lastVerifiedOn: get("last_verified_on"), attribution: "" };
  if (!title) errors.push("title is required");
  if (!slug) errors.push("slug could not be derived from the title");
  const address = { line1: get("address_line1"), line2: get("address_line2"), locality: get("locality"), region: get("region"), postalCode: get("postal_code"), approved: false };
  const tz = get("time_zone") || site.timeZone;
  if (kind === "store") {
    const hours = hoursFromRow(get);
    if (hours.error) errors.push(hours.error);
    const serviceIds: string[] = [];
    for (const s of get("services").split(";").map((x) => x.trim()).filter(Boolean)) {
      const id = services.get(s);
      if (!id) errors.push(`services: no service with slug "${s}" exists on this site`);
      else serviceIds.push(id);
    }
    const status = get("status") || "open";
    return { payload: { ...base, address, phone: get("phone"), timeZone: tz, weeklyHours: hours.value, exceptions: [], serviceItemIds: serviceIds, status, statusNote: get("status_note") }, errors, image, imageAlt, attachments };
  }
  if (kind === "service") {
    return { payload: { ...base, inquiryPrompt: get("inquiry_prompt") }, errors, image, imageAlt, attachments };
  }
  if (kind === "place") {
    const hours = hoursFromRow(get);
    if (hours.error) errors.push(hours.error);
    return { payload: { ...base, category: get("category"), address, areaDescription: get("area_description"), website: get("website"), phone: get("phone"), hours: hours.value, nextAction: { label: "", path: "" } }, errors, image, imageAlt, attachments };
  }
  if (kind === "article") {
    const publishedOn = get("published_on");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedOn)) errors.push("published_on: use YYYY-MM-DD");
    const updatedOn = get("updated_on");
    if (updatedOn && !/^\d{4}-\d{2}-\d{2}$/.test(updatedOn)) errors.push("updated_on: use YYYY-MM-DD");
    return { payload: { ...base, authorName: get("author_name"), publishedOn, updatedOn }, errors, image, imageAlt, attachments };
  }
  if (kind === "link") {
    const url = get("url");
    if (!/^https:\/\/[^\s/]+\S*$/i.test(url)) errors.push("url: use the full https:// address of the other website");
    return { payload: { ...base, url, category: get("category"), ctaLabel: get("cta_label") }, errors, image, imageAlt, attachments };
  }
  const startsAt = instantFromCell(get("starts_at"), tz);
  const endsAt = instantFromCell(get("ends_at"), tz);
  if (!startsAt) errors.push("starts_at: use YYYY-MM-DD HH:MM or an ISO instant");
  if (!endsAt) errors.push("ends_at: use YYYY-MM-DD HH:MM or an ISO instant");
  return { payload: { ...base, startsAt: startsAt ?? "", endsAt: endsAt ?? "", timeZone: tz, venueItemId: null, venueText: get("venue_text"), organizerName: get("organizer_name"), organizerUrl: get("organizer_url"), status: get("status") || "scheduled", eventUrl: get("event_url"), admission: get("admission") }, errors, image, imageAlt, attachments };
}

export interface DryRunRow {
  row: number;
  externalId: string;
  title: string;
  action: "create" | "update" | "skip" | "error";
  errors: string[];
  /** Featured image file named by the row (onboarding package), resolved to an asset when applied. */
  image?: string;
  imageAlt?: string;
  /** Document files named by the row (onboarding package), listed as downloads once applied (B5). */
  attachments?: string[];
}

export interface DryRunResult {
  counts: { create: number; update: number; skip: number; error: number; total: number };
  rows: DryRunRow[];
  /** Normalized payloads keyed by external id for valid rows (create/update). */
  valid: Record<string, Record<string, unknown>>;
}

function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (val && typeof val === "object" && !Array.isArray(val) ? Object.keys(val as object).sort().reduce((o: Record<string, unknown>, k) => ((o[k] = (val as Record<string, unknown>)[k]), o), {}) : val));
}

export interface DryRunOptions {
  /** File names available in the onboarding package's images folder; absent for a plain CSV import, where an image column must stay empty. */
  imageFiles?: Set<string>;
  /** File names available in the onboarding package's documents folder (B5); absent for a plain CSV import, where the attachments column must stay empty. */
  documentFiles?: Set<string>;
  /** Services the same package imports before the stores (slug → placeholder), so store rows may refer to them. */
  pendingServices?: Set<string>;
}

/** Validates every row and computes create/update/skip/error without writing anything. */
export async function dryRun(db: Db, site: SiteRow, kind: ImportableKind, parsed: ParsedCsv, mapping: Mapping, opts: DryRunOptions = {}): Promise<DryRunResult> {
  const spec = csvSpecs[kind];
  const services = new Map((await db<{ id: string; slug: string }[]>`select i.id, r.slug from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${site.id} and i.kind = 'service' and i.archived_at is null`).map((s) => [s.slug, s.id]));
  // Services the same package imports first count as existing (their ids are resolved when the stores are applied).
  for (const slug of opts.pendingServices ?? []) if (!services.has(slug)) services.set(slug, `pending:${slug}`);
  const existing = new Map((await db<{ externalId: string; payload: Record<string, unknown> }[]>`select i.external_id, r.payload from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${site.id} and i.kind = ${kind} and i.external_id is not null`).map((e) => [e.externalId, e.payload]));
  const result: DryRunResult = { counts: { create: 0, update: 0, skip: 0, error: 0, total: parsed.rows.length }, rows: [], valid: {} };
  const seen = new Set<string>();
  const slugs = new Map((await db<{ slug: string; externalId: string | null }[]>`select r.slug, i.external_id from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${site.id} and i.kind = ${kind} and i.archived_at is null`).map((s) => [s.slug, s.externalId]));
  for (const missing of spec.filter((c) => c.required && !mapping[c.key])) {
    result.rows.push({ row: 0, externalId: "", title: "", action: "error", errors: [`required column "${missing.key}" is not mapped`] });
    result.counts.error++;
    return result;
  }
  parsed.rows.forEach((row, index) => {
    const rowNo = index + 2; // header is line 1
    const externalId = (row[mapping.external_id ?? ""] ?? "").trim();
    const conv = rowToPayload(kind, row, mapping, site, services);
    const errors = [...conv.errors];
    if (!externalId) errors.push("external_id is required");
    else if (seen.has(externalId)) errors.push(`external_id "${externalId}" appears more than once in the file`);
    seen.add(externalId);
    if (conv.image) {
      if (!opts.imageFiles) errors.push("image: images come with the onboarding package; leave the column empty in a CSV import");
      else if (!opts.imageFiles.has(conv.image)) errors.push(`image: no file named "${conv.image}" in the package's images folder`);
    }
    for (const name of conv.attachments) {
      if (!opts.documentFiles) {
        errors.push("attachments: documents come with the onboarding package; leave the column empty in a CSV import");
        break;
      }
      if (!opts.documentFiles.has(name)) errors.push(`attachments: no file named "${name}" in the package's documents folder`);
    }
    let normalized: Record<string, unknown> | null = null;
    if (conv.payload && errors.length === 0) {
      try {
        // Pending service references are placeholders, not uuids; they are resolved when applied.
        const forCheck = kind === "store" ? { ...conv.payload, serviceItemIds: ((conv.payload.serviceItemIds as string[]) ?? []).filter((id) => !id.startsWith("pending:")) } : conv.payload;
        normalized = validatePayload(kind, forCheck);
        if (kind === "store") normalized.serviceItemIds = conv.payload.serviceItemIds;
      } catch (err) {
        if (err instanceof ContentValidationError) errors.push(...err.issues.map((i) => `${i.path || "row"}: ${i.message}`));
        else throw err;
      }
    }
    if (normalized) {
      const slugOwner = slugs.get(normalized.slug as string);
      if (slugOwner !== undefined && slugOwner !== externalId) errors.push(`slug "${normalized.slug}" is already used by another item`);
    }
    const title = conv.payload ? String(conv.payload.title ?? "") : "";
    const imageFields = { ...(conv.image ? { image: conv.image, ...(conv.imageAlt ? { imageAlt: conv.imageAlt } : {}) } : {}), ...(conv.attachments.length ? { attachments: conv.attachments } : {}) };
    if (errors.length) {
      result.rows.push({ row: rowNo, externalId, title, action: "error", errors, ...imageFields });
      result.counts.error++;
      return;
    }
    const current = existing.get(externalId);
    if (current && !conv.image && conv.attachments.length === 0 && stable(current) === stable(normalized)) {
      result.rows.push({ row: rowNo, externalId, title, action: "skip", errors: [] });
      result.counts.skip++;
      return;
    }
    result.rows.push({ row: rowNo, externalId, title, action: current ? "update" : "create", errors: [], ...imageFields });
    result.counts[current ? "update" : "create"]++;
    result.valid[externalId] = normalized!;
  });
  return result;
}

export interface ApplyOptions {
  /** Approve every written revision on save (the importer may publish and the site does not require review). */
  approve?: boolean;
  /** Asset ids of the package's images by file name (onboarding), for rows that name a featured image. */
  imageAssets?: Map<string, string>;
  /** Asset ids of the package's documents by file name (onboarding, B5), for rows that list attachments. */
  documentAssets?: Map<string, string>;
  /** Ids of the services the package imported, by slug, for store rows that refer to them. */
  serviceIds?: Map<string, string>;
}

/**
 * Applies a confirmed dry run inside one transaction: creates or updates items. With
 * `approve` (the importer may publish and the site does not require review, B1's rule) every
 * written revision is approved on save like an editor save; otherwise the items are drafts.
 */
export async function applyImport(db: Db, site: SiteRow, kind: ImportableKind, userId: string, dry: DryRunResult, opts: ApplyOptions = {}): Promise<{ created: number; updated: number; skipped: number; approved: boolean }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const approve = Boolean(opts.approve);
  for (const row of dry.rows) {
    if (row.action !== "create" && row.action !== "update") continue;
    let payload = dry.valid[row.externalId];
    if (!payload) continue;
    if (row.image) {
      const assetId = opts.imageAssets?.get(row.image);
      if (!assetId) throw new Error(`image "${row.image}" was not imported; nothing was written`);
      payload = { ...payload, featuredImageAssetId: assetId };
    }
    if (row.attachments?.length) {
      const attachments = row.attachments.map((name) => {
        const assetId = opts.documentAssets?.get(name);
        if (!assetId) throw new Error(`document "${name}" was not imported; nothing was written`);
        return { assetId, label: "" };
      });
      payload = { ...payload, attachments };
    }
    if (kind === "store" && Array.isArray(payload.serviceItemIds)) {
      payload = { ...payload, serviceItemIds: (payload.serviceItemIds as string[]).map((id) => (id.startsWith("pending:") ? opts.serviceIds?.get(id.slice(8)) : id)).filter((id): id is string => Boolean(id)) };
      payload = validatePayload(kind, payload);
    }
    const [existing] = await db<{ id: string }[]>`select id from public.content_items where site_id = ${site.id} and kind = ${kind} and external_id = ${row.externalId}`;
    if (!existing) {
      const made = await createContentItem(db, { siteId: site.id, organizationId: site.organizationId, kind, payload, authorId: userId, externalId: row.externalId, changeNote: "CSV import" });
      if (approve) await approveOnSave(db, { item: made.item, revisionId: made.revision.id, actorId: userId });
      created++;
      continue;
    }
    const current = (await getItem(db, existing.id))!;
    if (stable(current.revision.payload) === stable(payload)) {
      skipped++;
      continue;
    }
    const saved = await saveRevision(db, { itemId: existing.id, baseRevisionId: current.revision.id, payload, authorId: userId, changeNote: "CSV import" });
    if (!saved.ok) throw new Error(`concurrent edit on ${row.externalId}; import aborted, nothing was written`);
    if (approve) await approveOnSave(db, { item: { id: existing.id, organizationId: site.organizationId, siteId: site.id }, revisionId: saved.revision.id, actorId: userId });
    updated++;
  }
  return { created, updated, skipped, approved: approve };
}

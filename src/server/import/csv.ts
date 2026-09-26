import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import type { Db } from "@/server/data/db";
import type { SiteRow } from "@/server/data/access";
import { csvSpecs, type ImportableKind } from "@/server/import/csv-spec";
import { validatePayload, createContentItem, saveRevision, getItem, ContentValidationError } from "@/server/data/content";
import { slugify } from "@/lib/slug";
import type { HoursInterval, WeeklyHours } from "@/modules/common";
import { fromLocalInput } from "@/components/admin/editor/kind-fields";

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

/** Converts one CSV row into a content payload for the kind. */
export function rowToPayload(kind: ImportableKind, row: Record<string, string>, mapping: Mapping, site: { timeZone: string }, services: Map<string, string>): { payload?: Record<string, unknown>; errors: string[] } {
  const get = (key: string) => (mapping[key] ? (row[mapping[key]!] ?? "").trim() : "");
  const errors: string[] = [];
  const title = get("title");
  const slug = get("slug") ? slugify(get("slug")) : slugify(title);
  const base = { schemaVersion: 1, title, slug, summary: get("summary"), body: [], featuredImageAssetId: null, metaTitle: "", metaDescription: "", indexable: true, sourceUrl: get("source_url"), lastVerifiedOn: get("last_verified_on"), attribution: "" };
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
    return { payload: { ...base, address, phone: get("phone"), timeZone: tz, weeklyHours: hours.value, exceptions: [], serviceItemIds: serviceIds, status, statusNote: get("status_note") }, errors };
  }
  if (kind === "place") {
    const hours = hoursFromRow(get);
    if (hours.error) errors.push(hours.error);
    return { payload: { ...base, category: get("category"), address, areaDescription: get("area_description"), website: get("website"), phone: get("phone"), hours: hours.value, nextAction: { label: "", path: "" } }, errors };
  }
  const startsAt = instantFromCell(get("starts_at"), tz);
  const endsAt = instantFromCell(get("ends_at"), tz);
  if (!startsAt) errors.push("starts_at: use YYYY-MM-DD HH:MM or an ISO instant");
  if (!endsAt) errors.push("ends_at: use YYYY-MM-DD HH:MM or an ISO instant");
  return { payload: { ...base, startsAt: startsAt ?? "", endsAt: endsAt ?? "", timeZone: tz, venueItemId: null, venueText: get("venue_text"), organizerName: get("organizer_name"), organizerUrl: get("organizer_url"), status: get("status") || "scheduled", eventUrl: get("event_url"), admission: get("admission") }, errors };
}

export interface DryRunRow {
  row: number;
  externalId: string;
  title: string;
  action: "create" | "update" | "skip" | "error";
  errors: string[];
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

/** Validates every row and computes create/update/skip/error without writing anything. */
export async function dryRun(db: Db, site: SiteRow, kind: ImportableKind, parsed: ParsedCsv, mapping: Mapping): Promise<DryRunResult> {
  const spec = csvSpecs[kind];
  const services = new Map((await db<{ id: string; slug: string }[]>`select i.id, r.slug from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${site.id} and i.kind = 'service' and i.archived_at is null`).map((s) => [s.slug, s.id]));
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
    let normalized: Record<string, unknown> | null = null;
    if (conv.payload && errors.length === 0) {
      try {
        normalized = validatePayload(kind, conv.payload);
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
    if (errors.length) {
      result.rows.push({ row: rowNo, externalId, title, action: "error", errors });
      result.counts.error++;
      return;
    }
    const current = existing.get(externalId);
    if (current && stable(current) === stable(normalized)) {
      result.rows.push({ row: rowNo, externalId, title, action: "skip", errors: [] });
      result.counts.skip++;
      return;
    }
    result.rows.push({ row: rowNo, externalId, title, action: current ? "update" : "create", errors: [] });
    result.counts[current ? "update" : "create"]++;
    result.valid[externalId] = normalized!;
  });
  return result;
}

/** Applies a confirmed dry run inside one transaction: creates or updates items as drafts. */
export async function applyImport(db: Db, site: SiteRow, kind: ImportableKind, userId: string, dry: DryRunResult): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const row of dry.rows) {
    if (row.action !== "create" && row.action !== "update") continue;
    const payload = dry.valid[row.externalId];
    if (!payload) continue;
    const [existing] = await db<{ id: string }[]>`select id from public.content_items where site_id = ${site.id} and kind = ${kind} and external_id = ${row.externalId}`;
    if (!existing) {
      await createContentItem(db, { siteId: site.id, organizationId: site.organizationId, kind, payload, authorId: userId, externalId: row.externalId, changeNote: "CSV import" });
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
    updated++;
  }
  return { created, updated, skipped };
}

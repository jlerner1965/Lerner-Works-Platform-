import { createHash } from "node:crypto";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import type { Db } from "@/server/data/db";
import type { SiteRow } from "@/server/data/access";
import { getStorage } from "@/server/media/storage";
import { getCurrentSiteConfig, saveSiteConfig } from "@/server/data/sites";
import { siteConfigSchema } from "@/modules/site-config";
import { kindRegistry, isContentKind, type ContentKind } from "@/modules/registry";
import { validatePayload, createContentItem, saveRevision, getItem } from "@/server/data/content";
import { ingestImage } from "@/server/media/ingest";
import { normalizeSnapshot } from "@/server/publishing/snapshot";

export const PACKAGE_VERSION = 1;
export const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
const MAX_FILES = 500;
const MAX_UNCOMPRESSED = 256 * 1024 * 1024;

interface PackageManifest {
  packageVersion: number;
  exportedAt: string;
  source: { siteKey: string; siteName: string; preset: string; timeZone: string; contact: { email: string; phone: string; address: string } };
  counts: { items: number; media: number; redirects: number };
  files: Array<{ path: string; sha256: string; bytes: number }>;
}

interface PackagedItem {
  id: string;
  kind: ContentKind;
  externalId: string | null;
  archived: boolean;
  payload: Record<string, unknown>;
}

interface PackagedMedia {
  id: string;
  file: string;
  sha256: string;
  width: number;
  height: number;
  title: string;
  alt: string;
  decorative: boolean;
  attribution: string;
  license: string;
  sourceUrl: string;
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** Builds a portable ZIP of a site: content, configuration, redirects and media derivatives. No secrets, users or inquiries. */
export async function exportSitePackage(db: Db, site: SiteRow): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const manifestFiles: PackageManifest["files"] = [];
  const add = (path: string, data: Uint8Array) => {
    files[path] = data;
    manifestFiles.push({ path, sha256: sha(data), bytes: data.byteLength });
  };
  const items = await db<Array<{ id: string; kind: ContentKind; externalId: string | null; archivedAt: Date | null; payload: Record<string, unknown> }>>`
    select i.id, i.kind, i.external_id, i.archived_at, r.payload from public.content_items i join public.content_revisions r on r.id = i.current_revision_id
    where i.site_id = ${site.id} order by i.kind, r.title`;
  for (const it of items) {
    const packaged: PackagedItem = { id: it.id, kind: it.kind, externalId: it.externalId, archived: it.archivedAt !== null, payload: it.payload };
    add(`content/${it.kind}/${it.id}.json`, strToU8(JSON.stringify(packaged, null, 2)));
  }
  const config = await getCurrentSiteConfig(db, site.id);
  if (config) add("site-config.json", strToU8(JSON.stringify(config.config, null, 2)));
  const [active] = await db<{ snapshot: unknown }[]>`select snapshot from public.releases where id = ${site.activeReleaseId}`;
  const redirects = (active ? normalizeSnapshot(active.snapshot) : null)?.redirects ?? [];
  add("redirects.json", strToU8(JSON.stringify(redirects, null, 2)));
  const media = await db<Array<{ id: string; title: string | null; altText: string | null; decorative: boolean; attributionText: string | null; license: string | null; sourceUrl: string | null; derivatives: Record<string, { key: string; width: number; height: number; hash: string }> }>>`
    select id, title, alt_text, decorative, attribution_text, license, source_url, derivatives from public.media_assets where site_id = ${site.id} and status = 'ready' order by created_at`;
  const storage = getStorage();
  let mediaCount = 0;
  for (const m of media) {
    const best = m.derivatives.w1600 ?? m.derivatives.w960 ?? m.derivatives.w480;
    if (!best) continue;
    const data = await storage.getPrivate(best.key);
    if (!data) continue;
    const file = `media/${m.id}/image.webp`;
    add(file, data);
    const meta: PackagedMedia = { id: m.id, file, sha256: sha(data), width: best.width, height: best.height, title: m.title ?? "", alt: m.altText ?? "", decorative: m.decorative, attribution: m.attributionText ?? "", license: m.license ?? "", sourceUrl: m.sourceUrl ?? "" };
    add(`media/${m.id}/meta.json`, strToU8(JSON.stringify(meta, null, 2)));
    mediaCount++;
  }
  const readme = `# Lerner Works site package

Exported ${new Date().toISOString()} from site "${site.name}" (key ${site.key}, preset ${site.preset}).

## Contents
- manifest.json — package version, source identity, counts and a SHA-256 for every file.
- site-config.json — branding, navigation, footer, modules and metadata (schema version inside).
- content/<kind>/<id>.json — the current working revision of every content item (payload, kind, external id, archived flag).
- redirects.json — redirects from the active release, if any.
- media/<id>/image.webp + meta.json — the largest published-quality derivative of each ready image with its rights metadata.

## Not included, by design
Passwords, tokens, provider secrets, memberships, invitations, audit data, inquiries, notification recipients and domain bindings.

## Limitations
- Original uploads are not included; derivatives are web quality (max 1600 px wide).
- Review history and release history are not included; imported content starts as drafts.
- Importing into a site maps every id to a new id; internal references are rewritten.
`;
  add("README.md", strToU8(readme));
  const manifest: PackageManifest = {
    packageVersion: PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    source: { siteKey: site.key, siteName: site.name, preset: site.preset, timeZone: site.timeZone, contact: { email: site.contactEmail ?? "", phone: site.contactPhone ?? "", address: site.contactAddress ?? "" } },
    counts: { items: items.length, media: mediaCount, redirects: redirects.length },
    files: manifestFiles,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(files, { level: 6 });
}

export interface PackageDryRun {
  manifest: PackageManifest | null;
  errors: string[];
  warnings: string[];
  summary: { items: number; media: number; byKind: Record<string, number>; adoptablePages: number };
  items: PackagedItem[];
  media: Array<PackagedMedia & { data: Uint8Array }>;
  config: unknown;
  redirects: Array<{ from: string; to: string }>;
}

const SAFE_PATH = /^(manifest\.json|README\.md|site-config\.json|redirects\.json|content\/(page|place|event|article|store|service)\/[0-9a-f-]{36}\.json|media\/[0-9a-f-]{36}\/(image\.webp|meta\.json))$/;

/** Validates a package without writing: structure, sizes, checksums, schema versions, payloads. */
export async function dryRunPackage(db: Db, site: SiteRow, bytes: Uint8Array): Promise<PackageDryRun> {
  const out: PackageDryRun = { manifest: null, errors: [], warnings: [], summary: { items: 0, media: 0, byKind: {}, adoptablePages: 0 }, items: [], media: [], config: null, redirects: [] };
  if (bytes.byteLength > MAX_PACKAGE_BYTES) {
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
  const paths = Object.keys(entries).filter((p) => !p.endsWith("/"));
  if (paths.length > MAX_FILES) out.errors.push(`The package has ${paths.length} files; the limit is ${MAX_FILES}.`);
  for (const p of paths) if (!SAFE_PATH.test(p)) out.errors.push(`Unexpected file path in package: ${p}`);
  if (out.errors.length) return out;
  const manifestRaw = entries["manifest.json"];
  if (!manifestRaw) {
    out.errors.push("manifest.json is missing.");
    return out;
  }
  let manifest: PackageManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestRaw)) as PackageManifest;
  } catch {
    out.errors.push("manifest.json is not valid JSON.");
    return out;
  }
  out.manifest = manifest;
  if (manifest.packageVersion !== PACKAGE_VERSION) out.errors.push(`Package version ${manifest.packageVersion} is not supported (expected ${PACKAGE_VERSION}).`);
  for (const f of manifest.files ?? []) {
    const data = entries[f.path];
    if (!data) out.errors.push(`File listed in manifest is missing: ${f.path}`);
    else if (sha(data) !== f.sha256) out.errors.push(`Checksum mismatch for ${f.path}`);
  }
  for (const p of paths) if (p !== "manifest.json" && !manifest.files?.some((f) => f.path === p)) out.errors.push(`File not listed in manifest: ${p}`);
  if (out.errors.length) return out;
  const cfgRaw = entries["site-config.json"];
  if (cfgRaw) {
    const parsed = siteConfigSchema.safeParse(JSON.parse(strFromU8(cfgRaw)));
    if (!parsed.success) out.errors.push("site-config.json does not match the configuration schema.");
    else out.config = parsed.data;
  }
  const redirectsRaw = entries["redirects.json"];
  if (redirectsRaw) {
    try {
      const r = JSON.parse(strFromU8(redirectsRaw)) as Array<{ from: string; to: string }>;
      out.redirects = Array.isArray(r) ? r.filter((x) => typeof x.from === "string" && typeof x.to === "string") : [];
    } catch {
      out.warnings.push("redirects.json could not be read; redirects are skipped.");
    }
  }
  for (const p of paths.filter((x) => x.startsWith("media/") && x.endsWith("meta.json"))) {
    const meta = JSON.parse(strFromU8(entries[p]!)) as PackagedMedia;
    const data = entries[meta.file];
    if (!data) {
      out.errors.push(`Media file missing for ${meta.id}`);
      continue;
    }
    if (sha(data) !== meta.sha256) out.errors.push(`Media checksum mismatch for ${meta.id}`);
    if (!meta.license) out.warnings.push(`Image "${meta.title || meta.id.slice(0, 8)}" has no license recorded; publication will be blocked until one is added.`);
    out.media.push({ ...meta, data });
  }
  for (const p of paths.filter((x) => x.startsWith("content/"))) {
    let item: PackagedItem;
    try {
      item = JSON.parse(strFromU8(entries[p]!)) as PackagedItem;
    } catch {
      out.errors.push(`${p} is not valid JSON.`);
      continue;
    }
    if (!isContentKind(item.kind) || !kindRegistry[item.kind]) {
      out.errors.push(`${p}: unknown kind ${String(item.kind)}`);
      continue;
    }
    const parsed = kindRegistry[item.kind].schema.safeParse(item.payload);
    if (!parsed.success) {
      out.errors.push(`${p}: ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    out.items.push(item);
    out.summary.byKind[item.kind] = (out.summary.byKind[item.kind] ?? 0) + 1;
  }
  out.summary.items = out.items.length;
  out.summary.media = out.media.length;
  const pageSlugs = new Set(out.items.filter((i) => i.kind === "page").map((i) => String(i.payload.slug)));
  const starter = await db<{ slug: string }[]>`select r.slug from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${site.id} and i.kind = 'page' and i.external_id is null and i.archived_at is null`;
  out.summary.adoptablePages = starter.filter((s) => pageSlugs.has(s.slug)).length;
  const existing = await db<{ n: number }[]>`select count(*)::int as n from public.content_items where site_id = ${site.id} and kind <> 'page'`;
  if ((existing[0]?.n ?? 0) > 0) out.warnings.push("This site already has content; imported items are added alongside it (nothing is overwritten except same-slug starter pages).");
  return out;
}

/** Rewrites every id-shaped string in a payload through the old→new map (item ids and asset ids). */
function remap(value: unknown, map: Map<string, string>): unknown {
  if (typeof value === "string") {
    if (map.has(value)) return map.get(value);
    if (value.startsWith("item:") && map.has(value.slice(5))) return `item:${map.get(value.slice(5))}`;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => remap(v, map));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = remap(v, map);
    return out;
  }
  return value;
}

/** Imports a validated package into the site as drafts, with an old→new id map. Never touches domains, members or recipients. */
export async function applyPackage(db: Db, site: SiteRow, userId: string, dry: PackageDryRun): Promise<{ items: number; media: number; adoptedPages: number; configRevision: number | null }> {
  if (dry.errors.length) throw new Error("package has validation errors");
  const idMap = new Map<string, string>();
  let mediaCount = 0;
  for (const m of dry.media) {
    const result = await ingestImage(db, { siteId: site.id, organizationId: site.organizationId, userId, bytes: m.data, filename: `${m.id}.webp`, declaredMime: "image/webp", title: m.title, altText: m.alt, decorative: m.decorative, attributionText: m.attribution, license: m.license, sourceUrl: m.sourceUrl });
    if (!result.ok) throw new Error(`image ${m.id}: ${result.error}`);
    idMap.set(m.id, result.asset.id);
    mediaCount++;
  }
  // Two passes: allocate ids first so cross-references can be rewritten.
  const starter = new Map((await db<{ id: string; slug: string }[]>`select i.id, r.slug from public.content_items i join public.content_revisions r on r.id = i.current_revision_id where i.site_id = ${site.id} and i.kind = 'page' and i.external_id is null and i.archived_at is null`).map((s) => [s.slug, s.id]));
  let adopted = 0;
  const pending: Array<{ item: PackagedItem; targetId: string; isNew: boolean }> = [];
  for (const item of dry.items) {
    const slug = String(item.payload.slug);
    if (item.kind === "page" && starter.has(slug)) {
      const targetId = starter.get(slug)!;
      idMap.set(item.id, targetId);
      pending.push({ item, targetId, isNew: false });
      adopted++;
      continue;
    }
    const placeholder = { ...item.payload, featuredImageAssetId: null } as Record<string, unknown>;
    const stripped = stripRefs(placeholder);
    const created = await createContentItem(db, { siteId: site.id, organizationId: site.organizationId, kind: item.kind, payload: validatePayload(item.kind, stripped), authorId: userId, externalId: item.externalId ? `pkg:${item.externalId}` : null, changeNote: "Imported from site package" });
    idMap.set(item.id, created.item.id);
    pending.push({ item, targetId: created.item.id, isNew: true });
  }
  for (const { item, targetId } of pending) {
    const payload = validatePayload(item.kind, remap(item.payload, idMap) as Record<string, unknown>);
    const current = (await getItem(db, targetId))!;
    const saved = await saveRevision(db, { itemId: targetId, baseRevisionId: current.revision.id, payload, authorId: userId, changeNote: "Imported from site package" });
    if (!saved.ok) throw new Error("concurrent edit during import");
    if (item.archived) await db`update public.content_items set archived_at = now(), archived_by = ${userId} where id = ${targetId}`;
  }
  let configRevision: number | null = null;
  if (dry.config) {
    const current = await getCurrentSiteConfig(db, site.id);
    if (current) {
      const config = remap(dry.config, idMap) as Record<string, unknown>;
      const saved = await saveSiteConfig(db, { siteId: site.id, organizationId: site.organizationId, baseRevisionId: current.id, config, authorId: userId, changeNote: "Imported from site package" });
      if (saved.ok) configRevision = saved.revision.version;
    }
  }
  return { items: pending.length, media: mediaCount, adoptedPages: adopted, configRevision };
}

function stripRefs(value: unknown): Record<string, unknown> {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)) return null;
    if (Array.isArray(v)) return v.map(walk).filter((x) => x !== null);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(value) as Record<string, unknown>;
}

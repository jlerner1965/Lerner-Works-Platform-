import { createHash } from "node:crypto";
import { withUser, type Db } from "@/server/data/db";
import { getStorage } from "@/server/media/storage";
import { inspectSiteArchive, publicNameFor, toUploadedSnapshot, type ArchiveInspection, type GithubSourceRef, type UploadedSnapshot } from "./archive";

/**
 * Publishing an uploaded site (B7): the ZIP is inspected, every file is copied to public
 * storage under its content-hash name (a name that exists already holds the same bytes), and
 * one SQL function inserts the release with the manifest and activates it. Nothing is written
 * to the database before the files are in place, so a storage failure leaves no release that
 * cannot be served.
 */

export interface PublishedUpload {
  releaseId: string;
  version: number;
  outcome: "published" | "already_published";
  files: number;
  totalBytes: number;
}

export type PublishUploadResult = { ok: true; release: PublishedUpload; inspection: ArchiveInspection } | { ok: false; errors: string[]; inspection: ArchiveInspection | null };

/** Deterministic JSON for the snapshot hash: keys sorted at every level. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Copies the files a release needs to the public store, a few at a time; a name already there holds the same bytes. */
async function copyToPublicStore(inspection: ArchiveInspection, concurrency = 8): Promise<void> {
  const storage = getStorage();
  const queue = [...inspection.files];
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const name = publicNameFor(f.sha256, f.path);
      if (!(await storage.existsPublic(name))) await storage.putPublic(name, f.data, f.type);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
}

export async function publishUploadedSite(
  userId: string,
  site: { id: string; siteType: "structured" | "uploaded" },
  bytes: Uint8Array,
  opts: { filename: string; reason: string | null; idempotencyKey: string; root?: string | null; github?: GithubSourceRef | null },
): Promise<PublishUploadResult> {
  if (site.siteType !== "uploaded") return { ok: false, errors: ["This site is not an uploaded site."], inspection: null };
  const inspection = inspectSiteArchive(bytes, { root: opts.root ?? null });
  if (inspection.errors.length) return { ok: false, errors: inspection.errors, inspection };
  await copyToPublicStore(inspection);
  const snapshot: UploadedSnapshot = toUploadedSnapshot(inspection, { filename: opts.filename, archiveBytes: bytes.byteLength, github: opts.github ?? null });
  const snapshotHash = createHash("sha256").update(stableJson(snapshot)).digest("hex");
  const rows = await withUser(userId, (db) => db<{ releaseId: string; version: number; outcome: string }[]>`
    select release_id, version, outcome from public.publish_uploaded_release(${site.id}, ${db.json(snapshot as never)}, ${snapshotHash}, ${opts.reason}, ${opts.idempotencyKey})`);
  const row = rows[0];
  if (!row) return { ok: false, errors: ["Publishing returned no result."], inspection };
  return {
    ok: true,
    release: { releaseId: row.releaseId, version: row.version, outcome: row.outcome === "already_published" ? "already_published" : "published", files: inspection.files.length, totalBytes: inspection.totalBytes },
    inspection,
  };
}

export interface UploadedReleaseRow {
  id: string;
  version: number;
  createdAt: Date;
  reason: string | null;
  restoredFromReleaseId: string | null;
  restorationBlockedReason: string | null;
  actor: string | null;
  source: UploadedSnapshot["source"] | null;
}

/** The releases of an uploaded site, newest first, with what each upload held. */
export async function listUploadedReleases(db: Db, siteId: string): Promise<UploadedReleaseRow[]> {
  return db<UploadedReleaseRow[]>`
    select r.id, r.version, r.created_at, r.reason, r.restored_from_release_id, r.restoration_blocked_reason,
      public.user_display(r.actor_id) as actor, r.snapshot->'source' as source
    from public.releases r where r.site_id = ${siteId} order by r.version desc limit 50`;
}

/** The inspection summary stored with an upload job (B7, B8), without the file bytes. */
export function inspectionSummary(inspection: ArchiveInspection, source: { filename: string; archiveBytes: number; github?: GithubSourceRef | null }) {
  return {
    filename: source.filename.slice(0, 200),
    archiveBytes: source.archiveBytes,
    files: inspection.files.length,
    totalBytes: inspection.totalBytes,
    strippedFolder: inspection.strippedFolder,
    root: inspection.root,
    rootDetected: inspection.rootDetected,
    hasIndex: inspection.hasIndex,
    hasNotFoundPage: inspection.hasNotFoundPage,
    warnings: inspection.warnings,
    errors: inspection.errors,
    leftOut: inspection.leftOut.slice(0, 200),
    github: source.github ?? null,
    listing: inspection.files.slice(0, 300).map((f) => ({ path: f.path, bytes: f.bytes, type: f.type })),
  };
}

export type UploadJobSummary = ReturnType<typeof inspectionSummary>;

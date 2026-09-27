import { withUser, describeDbError, type Db } from "@/server/data/db";
import { getStorage } from "@/server/media/storage";
import { getCandidate, type CandidateRow } from "@/server/publishing/candidates";
import { validateManifest, type ValidationResult } from "@/server/publishing/validate";
import { toSnapshotMedia, type BuiltManifest, type MediaAssetRow } from "@/server/publishing/manifest";
import { SUPPORTED_SNAPSHOT_SCHEMA_VERSIONS, type ReleaseSnapshot } from "@/server/publishing/snapshot";
import { publicAssetContentType } from "@/server/media/content-types";
import { UPLOADED_SCHEMA_VERSION } from "@/server/uploaded/archive";

/** Every release format the running application can serve: the structured snapshots and the uploaded-site manifests (B7). */
export const RESTORABLE_SCHEMA_VERSIONS = [...SUPPORTED_SNAPSHOT_SCHEMA_VERSIONS, UPLOADED_SCHEMA_VERSION];

export type ActivationResult =
  | { outcome: "activated" | "already_activated"; releaseId: string }
  | { outcome: "conflict"; message: string }
  | { outcome: "blocked"; validation: ValidationResult; message: string }
  | { outcome: "assets_failed"; message: string }
  | { outcome: "error"; message: string };

/** Re-validates a frozen manifest against current media availability. No mutable content is read. */
async function revalidate(db: Db, cand: CandidateRow, now: Date): Promise<ValidationResult> {
  const ids = Object.keys(cand.manifest.media);
  const rows = ids.length ? await db<MediaAssetRow[]>`select * from public.media_assets where id = any(${ids}) and site_id = ${cand.siteId}` : [];
  const mediaRows = new Map(rows.map((r) => [r.id, r]));
  const missingMedia: BuiltManifest["missingMedia"] = [];
  const media: ReleaseSnapshot["media"] = {};
  for (const id of ids) {
    const row = mediaRows.get(id);
    if (!row || row.status !== "ready") missingMedia.push({ assetId: id, itemId: null, field: "media" });
    else media[id] = toSnapshotMedia(row);
  }
  return validateManifest({ manifest: { ...cand.manifest, media: ids.length ? media : cand.manifest.media }, notes: [], mediaRows, missingMedia, mediaKindMismatches: [] }, { now });
}

/**
 * Copies every referenced derivative (image variants and document files, B5) into public
 * content-hash storage under its own content type. Runs outside any database transaction;
 * failures leave the candidate unactivated and retryable.
 */
export async function preparePublicationAssets(cand: CandidateRow): Promise<{ ok: true } | { ok: false; message: string }> {
  const storage = getStorage();
  for (const media of Object.values(cand.manifest.media)) {
    for (const variant of Object.values(media.variants)) {
      if (!variant) continue;
      const contentType = publicAssetContentType(variant.path);
      if (!contentType) return { ok: false, message: `Derivative ${variant.path} has a name the public store does not serve.` };
      if (await storage.existsPublic(variant.path)) continue;
      const data = await storage.getPrivate(variant.key);
      if (!data) return { ok: false, message: `Derivative ${variant.key} is missing from private storage; re-upload the ${media.kind === "document" ? "document" : "image"}.` };
      await storage.putPublic(variant.path, data, contentType);
    }
  }
  return { ok: true };
}

export async function verifyPublicationAssets(cand: CandidateRow): Promise<string[]> {
  const storage = getStorage();
  const missing: string[] = [];
  for (const media of Object.values(cand.manifest.media)) {
    for (const variant of Object.values(media.variants)) {
      if (variant && !(await storage.existsPublic(variant.path))) missing.push(variant.path);
    }
  }
  return missing;
}

/**
 * Activation: permission + state check, revalidation, asset preparation (outside the
 * transaction), then the atomic compare-and-swap SQL function with an idempotency key.
 */
export async function activateCandidate(userId: string, candidateId: string, idempotencyKey: string, reason: string | null, opts: { now?: Date } = {}): Promise<ActivationResult> {
  const now = opts.now ?? new Date();
  const cand = await withUser(userId, (db) => getCandidate(db, candidateId));
  if (!cand) return { outcome: "error", message: "Candidate not found." };
  if (cand.state === "activated" && cand.activatedReleaseId) return { outcome: "already_activated", releaseId: cand.activatedReleaseId };
  if (cand.state !== "ready") return { outcome: "conflict", message: `This candidate is ${cand.state}; build a new candidate.` };
  if (!SUPPORTED_SNAPSHOT_SCHEMA_VERSIONS.includes(cand.schemaVersion)) return { outcome: "error", message: "Candidate schema version is not supported." };

  const validation = await withUser(userId, (db) => revalidate(db, cand, now));
  if (validation.blockers.length > 0) {
    await withUser(userId, (db) => db`update public.release_candidates set validation = ${db.json(validation as never)}, state = 'blocked' where id = ${candidateId} and state = 'ready'`);
    return { outcome: "blocked", validation, message: "Validation found blockers; the candidate was marked blocked." };
  }

  const prepared = await preparePublicationAssets(cand);
  if (!prepared.ok) return { outcome: "assets_failed", message: prepared.message };
  const missing = await verifyPublicationAssets(cand);
  if (missing.length) return { outcome: "assets_failed", message: `Publication assets are missing after preparation: ${missing.slice(0, 3).join(", ")}` };
  await withUser(userId, (db) => db`update public.release_candidates set assets_prepared_at = now() where id = ${candidateId} and state = 'ready'`);

  try {
    const rows = await withUser(userId, (db) => db<{ releaseId: string | null; outcome: string }[]>`
      select release_id, outcome from public.activate_release_candidate(${candidateId}, ${idempotencyKey}, ${reason})`);
    const row = rows[0];
    if (!row) return { outcome: "error", message: "Activation returned no result." };
    if (row.outcome === "conflict") return { outcome: "conflict", message: "Another release was activated since this candidate was built. Build and review a new candidate." };
    if (!row.releaseId) return { outcome: "error", message: `Unexpected activation outcome: ${row.outcome}` };
    return { outcome: row.outcome === "already_activated" ? "already_activated" : "activated", releaseId: row.releaseId };
  } catch (err) {
    const d = describeDbError(err);
    if (d.code === "forbidden") return { outcome: "error", message: "You do not have permission to publish this site." };
    return { outcome: "error", message: d.message };
  }
}

export type RestoreResult = { outcome: "restored" | "already_restored" | "already_active"; releaseId: string } | { outcome: "error"; message: string };

export async function restoreRelease(userId: string, releaseId: string, idempotencyKey: string, reason: string): Promise<RestoreResult> {
  try {
    const rows = await withUser(userId, (db) => db<{ releaseId: string | null; outcome: string }[]>`
      select release_id, outcome from public.restore_release(${releaseId}, ${idempotencyKey}, ${reason}, ${RESTORABLE_SCHEMA_VERSIONS})`);
    const row = rows[0];
    if (!row || !row.releaseId) return { outcome: "error", message: "Restore returned no result." };
    return { outcome: row.outcome as "restored" | "already_restored" | "already_active", releaseId: row.releaseId };
  } catch (err) {
    return { outcome: "error", message: describeDbError(err).message };
  }
}

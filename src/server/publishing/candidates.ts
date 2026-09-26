import { withUser, type Db } from "@/server/data/db";
import { hashCanonical } from "@/lib/canonical-json";
import type { SiteRow } from "@/server/data/access";
import { buildManifest, resolveDefaultSelection, type Selection, type SelectionNote } from "@/server/publishing/manifest";
import { validateManifest, type Finding, type ValidationResult } from "@/server/publishing/validate";
import { summarizeChanges, type ChangeSummary } from "@/server/publishing/diff";
import { normalizeSnapshot, type ReleaseSnapshot } from "@/server/publishing/snapshot";

export interface CandidateRow {
  id: string;
  organizationId: string;
  siteId: string;
  baseReleaseId: string | null;
  configRevisionId: string;
  manifest: ReleaseSnapshot;
  manifestHash: string;
  schemaVersion: number;
  selection: { selection: Selection; notes: SelectionNote[] };
  summary: ChangeSummary;
  validation: ValidationResult;
  waivers: Array<{ code: string; itemId?: string; field?: string; reason: string; actorId: string; at: string }>;
  state: "ready" | "blocked" | "activated" | "superseded" | "discarded";
  assetsPreparedAt: Date | null;
  activatedReleaseId: string | null;
  activatedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseRow {
  id: string;
  organizationId: string;
  siteId: string;
  version: number;
  schemaVersion: number;
  snapshot: ReleaseSnapshot;
  snapshotHash: string;
  actorId: string | null;
  reason: string | null;
  sourceCandidateId: string | null;
  restoredFromReleaseId: string | null;
  baseReleaseId: string | null;
  idempotencyKey: string;
  waivers: unknown[];
  restorationBlockedReason: string | null;
  createdAt: Date;
}

export async function getActiveRelease(db: Db, site: SiteRow): Promise<ReleaseRow | null> {
  if (!site.activeReleaseId) return null;
  const [row] = await db<ReleaseRow[]>`select * from public.releases where id = ${site.activeReleaseId}`;
  return row ?? null;
}

export async function getRelease(db: Db, releaseId: string): Promise<ReleaseRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(releaseId)) return null;
  const [row] = await db<ReleaseRow[]>`select * from public.releases where id = ${releaseId}`;
  return row ?? null;
}

export async function listReleases(db: Db, siteId: string, limit = 50): Promise<ReleaseRow[]> {
  return db<ReleaseRow[]>`select * from public.releases where site_id = ${siteId} order by version desc limit ${limit}`;
}

export async function listCandidates(db: Db, siteId: string, limit = 20): Promise<CandidateRow[]> {
  return db<CandidateRow[]>`select * from public.release_candidates where site_id = ${siteId} order by created_at desc limit ${limit}`;
}

export async function getCandidate(db: Db, candidateId: string): Promise<CandidateRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(candidateId)) return null;
  const [row] = await db<CandidateRow[]>`select * from public.release_candidates where id = ${candidateId}`;
  return row ?? null;
}

export interface BuildCandidateResult {
  candidate: CandidateRow;
}

/**
 * Builds a release candidate: default selection, frozen manifest, hash, validation and a
 * human-readable change summary. The candidate never reads mutable content again.
 */
export async function buildCandidate(userId: string, site: SiteRow, opts: { selection?: Selection; now?: Date } = {}): Promise<BuildCandidateResult> {
  const now = opts.now ?? new Date();
  return withUser(userId, async (db) => {
    const [fresh] = await db<SiteRow[]>`select * from public.sites where id = ${site.id}`;
    if (!fresh) throw new Error("site not found");
    if (!fresh.currentConfigRevisionId) throw new Error("site has no configuration revision");
    const baseRelease = await getActiveRelease(db, fresh);
    const base = baseRelease ? normalizeSnapshot(baseRelease.snapshot) : null;
    let selection: Selection;
    let notes: SelectionNote[];
    if (opts.selection) {
      selection = opts.selection;
      notes = [];
    } else {
      const resolved = await resolveDefaultSelection(db, fresh.id, base, fresh.currentConfigRevisionId);
      selection = resolved.selection;
      notes = resolved.notes;
    }
    const built = await buildManifest(db, fresh, selection, base, notes);
    const validation = validateManifest(built, { now });
    const summary = summarizeChanges(base, built.manifest);
    const manifestHash = hashCanonical(built.manifest);
    const state = validation.blockers.length > 0 ? "blocked" : "ready";
    const [candidate] = await db<CandidateRow[]>`
      insert into public.release_candidates (organization_id, site_id, base_release_id, config_revision_id, manifest, manifest_hash, schema_version, selection, summary, validation, state, created_by)
      values (${fresh.organizationId}, ${fresh.id}, ${baseRelease?.id ?? null}, ${selection.configRevisionId}, ${db.json(built.manifest as never)}, ${manifestHash}, ${built.manifest.schemaVersion},
        ${db.json({ selection, notes } as never)}, ${db.json(summary as never)}, ${db.json(validation as never)}, ${state}, ${userId})
      returning *`;
    if (!candidate) throw new Error("candidate insert returned no row");
    await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata)
      values (${fresh.organizationId}, ${fresh.id}, ${userId}, 'candidate.built', 'release_candidate', ${candidate.id}, ${db.json({ state, blockers: validation.blockers.length, warnings: validation.warnings.length, manifestHash })})`;
    return { candidate };
  });
}

export async function discardCandidate(userId: string, candidateId: string): Promise<boolean> {
  return withUser(userId, async (db) => {
    const res = await db`update public.release_candidates set state = 'discarded' where id = ${candidateId} and state in ('ready', 'blocked')`;
    return res.count === 1;
  });
}

/** Records a waiver for a warning with a reason. Blockers cannot be waived. */
export async function waiveWarning(userId: string, candidateId: string, finding: Pick<Finding, "code" | "itemId" | "field">, reason: string): Promise<{ ok: boolean; message?: string }> {
  if (reason.trim().length < 3) return { ok: false, message: "A reason is required to waive a warning." };
  return withUser(userId, async (db) => {
    const cand = await getCandidate(db, candidateId);
    if (!cand) return { ok: false, message: "Candidate not found." };
    const exists = cand.validation.warnings.some((w) => w.code === finding.code && w.itemId === finding.itemId && w.field === finding.field);
    if (!exists) return { ok: false, message: "That warning is not part of this candidate." };
    const waivers = [...cand.waivers, { code: finding.code, itemId: finding.itemId, field: finding.field, reason: reason.trim(), actorId: userId, at: new Date().toISOString() }];
    await db`update public.release_candidates set waivers = ${db.json(waivers as never)} where id = ${candidateId} and state in ('ready', 'blocked')`;
    return { ok: true };
  });
}

export function isWaived(cand: CandidateRow, w: Finding): boolean {
  return cand.waivers.some((x) => x.code === w.code && x.itemId === w.itemId && x.field === w.field);
}

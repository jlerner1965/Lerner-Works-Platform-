import type { Sql } from "postgres";
import type { Db } from "@/server/data/db";
import type { SiteContext } from "@/server/data/access";
import { getConfig } from "@/server/config";
import { getStorage, type StorageProvider } from "@/server/media/storage";
import { MAX_ARCHIVE_BYTES } from "./archive";
import { archiveKey, assertUploadAllowed, registerUploadedArchive, type IntakeResult } from "./intake";

/**
 * Large uploads (B8, decision D-027). A hosted function accepts at most 4.5 MB per request,
 * so the browser sends a ZIP in parts: a session is opened with the file's name and size,
 * each part is stored privately under the session, and completing the session assembles the
 * parts in order, drops them and hands the archive to the same intake as a one-request
 * upload. Sessions left open are abandoned by the retention job, which removes their parts.
 */

export interface UploadSessionRow {
  id: string;
  organizationId: string;
  siteId: string;
  createdBy: string;
  filename: string;
  byteSize: number;
  partBytes: number;
  parts: number;
  received: number[];
  state: "open" | "completed" | "abandoned";
  jobId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export function uploadPartBytes(): number {
  return getConfig().UPLOAD_PART_BYTES;
}

export function sessionPrefix(organizationId: string, siteId: string, sessionId: string): string {
  return `${organizationId}/${siteId}/uploads/sessions/${sessionId}`;
}

function partKey(prefix: string, index: number): string {
  return `${prefix}/part-${String(index).padStart(5, "0")}`;
}

const UUID = /^[0-9a-f-]{36}$/i;

async function loadSession(db: Db, ctx: SiteContext, sessionId: string): Promise<UploadSessionRow> {
  if (!UUID.test(sessionId)) throw new Error("The upload was not found.");
  const rows = await db<UploadSessionRow[]>`select * from public.upload_sessions where id = ${sessionId} and site_id = ${ctx.site.id}`;
  const row = rows[0];
  if (!row) throw new Error("The upload was not found.");
  if (row.state !== "open") throw new Error(row.state === "completed" ? "This upload was already completed." : "This upload was abandoned; start it again.");
  // bigint columns arrive as strings; every comparison below needs a number.
  return { ...row, byteSize: Number(row.byteSize), partBytes: Number(row.partBytes), parts: Number(row.parts) };
}

/** Opens a session for a file of the given size; the browser then sends the parts the answer describes. */
export async function beginUploadSession(db: Db, ctx: SiteContext, userId: string, input: { filename: string; size: number }): Promise<{ id: string; partBytes: number; parts: number }> {
  assertUploadAllowed(ctx);
  const size = Math.floor(Number(input.size));
  if (!Number.isFinite(size) || size <= 0) throw new Error("Choose the ZIP of the site to upload.");
  if (size > MAX_ARCHIVE_BYTES) throw new Error(`The ZIP is larger than ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB.`);
  const partBytes = uploadPartBytes();
  const parts = Math.ceil(size / partBytes);
  const filename = (input.filename || "site.zip").replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "site.zip";
  const [row] = await db<{ id: string }[]>`insert into public.upload_sessions (organization_id, site_id, created_by, filename, byte_size, part_bytes, parts)
    values (${ctx.site.organizationId}, ${ctx.site.id}, ${userId}, ${filename}, ${size}, ${partBytes}, ${parts}) returning id`;
  return { id: row!.id, partBytes, parts };
}

/** Stores one part; a part sent twice replaces itself. */
export async function storeUploadPart(db: Db, ctx: SiteContext, userId: string, sessionId: string, index: number, bytes: Uint8Array): Promise<{ received: number; parts: number }> {
  assertUploadAllowed(ctx);
  const session = await loadSession(db, ctx, sessionId);
  if (session.createdBy !== userId) throw new Error("The upload belongs to another person.");
  if (!Number.isInteger(index) || index < 0 || index >= session.parts) throw new Error("The part number is outside the upload.");
  const expected = index < session.parts - 1 ? session.partBytes : session.byteSize - session.partBytes * (session.parts - 1);
  if (bytes.byteLength !== expected) throw new Error(`Part ${index + 1} should hold ${expected} bytes, not ${bytes.byteLength}.`);
  await getStorage().putPrivate(partKey(sessionPrefix(session.organizationId, session.siteId, session.id), index), bytes, "application/octet-stream");
  const rows = await db<{ received: number[] }[]>`update public.upload_sessions
    set received = case when ${index} = any(received) then received else array_append(received, ${index}) end
    where id = ${session.id} returning received`;
  return { received: rows[0]?.received.length ?? 0, parts: session.parts };
}

/** Assembles the parts, drops them, and takes the archive in like a one-request upload. */
export async function completeUploadSession(db: Db, ctx: SiteContext, userId: string, sessionId: string, input: { root?: string | null } = {}): Promise<IntakeResult> {
  assertUploadAllowed(ctx);
  const session = await loadSession(db, ctx, sessionId);
  if (session.createdBy !== userId) throw new Error("The upload belongs to another person.");
  const received = new Set(session.received);
  const missing: number[] = [];
  for (let i = 0; i < session.parts; i++) if (!received.has(i)) missing.push(i + 1);
  if (missing.length) throw new Error(`The upload is incomplete: part${missing.length === 1 ? "" : "s"} ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""} did not arrive. Upload the ZIP again.`);
  const storage = getStorage();
  const prefix = sessionPrefix(session.organizationId, session.siteId, session.id);
  const bytes = new Uint8Array(session.byteSize);
  let offset = 0;
  for (let i = 0; i < session.parts; i++) {
    const part = await storage.getPrivate(partKey(prefix, i));
    if (!part) throw new Error(`Part ${i + 1} of the upload is no longer stored. Upload the ZIP again.`);
    if (offset + part.byteLength > bytes.byteLength) throw new Error("The parts do not add up to the file's size. Upload the ZIP again.");
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  if (offset !== session.byteSize) throw new Error("The parts do not add up to the file's size. Upload the ZIP again.");
  const result = await registerUploadedArchive(db, ctx, userId, { filename: session.filename, bytes, root: input.root ?? null });
  await db`update public.upload_sessions set state = 'completed', job_id = ${result.jobId}, completed_at = now() where id = ${session.id}`;
  await storage.deletePrivatePrefix(prefix).catch(() => undefined);
  return result;
}

/** Retention (elevated connection): abandons sessions left open and cancels checks never published, removing their storage. */
export async function purgeUploads(admin: Sql, storage: StorageProvider = getStorage(), ages: { sessions: string; checks: string } = { sessions: "1 day", checks: "30 days" }): Promise<{ abandonedSessions: number; staleChecks: number; leftovers: number }> {
  let leftovers = 0;
  const sessions = await admin<{ id: string; organizationId: string; siteId: string }[]>`select * from public.purge_abandoned_uploads(${ages.sessions}::interval)`;
  for (const s of sessions) {
    try {
      await storage.deletePrivatePrefix(sessionPrefix(s.organizationId, s.siteId, s.id));
    } catch {
      leftovers++;
    }
  }
  const checks = await admin<{ id: string; organizationId: string; siteId: string }[]>`select * from public.purge_stale_upload_checks(${ages.checks}::interval)`;
  for (const c of checks) {
    try {
      await storage.deletePrivatePrefix(archiveKey(c.organizationId, c.siteId, c.id));
    } catch {
      leftovers++;
    }
  }
  return { abandonedSessions: sessions.length, staleChecks: checks.length, leftovers };
}

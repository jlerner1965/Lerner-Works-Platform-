import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@/server/data/db";
import { elevatedDb } from "@/server/data/elevated";
import type { SiteContext } from "@/server/data/access";
import { assertUploadAllowed } from "./intake";

/**
 * Push to deploy (B9, decision D-029): a built site is handed to the platform by the CI that
 * built it. A deploy token per site (`lwd_` and forty hex characters) is shown once and kept
 * as a SHA-256 hash; a request carrying it acts as the person who created it, so the release
 * carries their name and the token's rights end with theirs. Tokens are resolved through the
 * elevated connection, never through the client roles.
 */

export interface DeployTokenRow {
  id: string;
  organizationId: string;
  siteId: string;
  label: string;
  createdBy: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface ResolvedDeployToken {
  id: string;
  siteId: string;
  organizationId: string;
  createdBy: string;
  label: string;
}

const PREFIX = "lwd_";

export function hashDeployToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isDeployTokenShaped(token: string): boolean {
  return /^lwd_[0-9a-f]{40}$/.test(token);
}

/** Creates a token for the site; the plaintext is returned once and never stored. */
export async function createDeployToken(db: Db, ctx: SiteContext, userId: string, label: string): Promise<{ id: string; token: string; label: string }> {
  assertUploadAllowed(ctx);
  const clean = label.trim().replace(/[\u0000-\u001f]/g, "").slice(0, 80);
  const token = `${PREFIX}${randomBytes(20).toString("hex")}`;
  const [row] = await db<{ id: string }[]>`insert into public.site_deploy_tokens (organization_id, site_id, token_hash, label, created_by)
    values (${ctx.site.organizationId}, ${ctx.site.id}, ${hashDeployToken(token)}, ${clean}, ${userId}) returning id`;
  return { id: row!.id, token, label: clean };
}

export async function listDeployTokens(db: Db, siteId: string): Promise<DeployTokenRow[]> {
  return db<DeployTokenRow[]>`select id, organization_id, site_id, label, created_by, created_at, last_used_at, revoked_at
    from public.site_deploy_tokens where site_id = ${siteId} order by created_at desc limit 50`;
}

export async function revokeDeployToken(db: Db, ctx: SiteContext, tokenId: string): Promise<boolean> {
  assertUploadAllowed(ctx);
  const rows = await db<{ id: string }[]>`update public.site_deploy_tokens set revoked_at = now() where id = ${tokenId} and site_id = ${ctx.site.id} and revoked_at is null returning id`;
  return rows.length > 0;
}

/** The token a request carries, or null when it is missing, malformed, unknown or revoked. */
export async function resolveDeployToken(authorization: string | null): Promise<ResolvedDeployToken | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
  if (!m || !isDeployTokenShaped(m[1]!)) return null;
  const admin = elevatedDb();
  const rows = await admin<{ id: string; siteId: string; organizationId: string; createdBy: string; label: string }[]>`
    select id, site_id, organization_id, created_by, label from public.site_deploy_tokens where token_hash = ${hashDeployToken(m[1]!)} and revoked_at is null`;
  return rows[0] ?? null;
}

export async function touchDeployToken(tokenId: string): Promise<void> {
  await elevatedDb()`update public.site_deploy_tokens set last_used_at = now() where id = ${tokenId}`;
}

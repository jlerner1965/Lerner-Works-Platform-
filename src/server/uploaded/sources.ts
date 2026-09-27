import type { Db } from "@/server/data/db";
import type { SiteContext } from "@/server/data/access";
import { openSecret, sealSecret, secretTail } from "@/server/secrets/crypto";
import type { GithubSourceRef } from "./archive";
import { githubBranchHead, githubRepositoryInfo, githubTokenIdentity, githubZipball, parseGithubSource, type GithubOptions } from "./github";
import { assertUploadAllowed, registerUploadedArchive, type IntakeResult } from "./intake";

/**
 * Where an uploaded site's files come from when they are fetched rather than uploaded (B8):
 * one GitHub source per site (repository, branch, folder) remembered after the first check,
 * so the next version is one click; and the organization's GitHub token, sealed at rest and
 * used only on the server.
 */

export interface SiteSourceRow {
  siteId: string;
  organizationId: string;
  kind: "github";
  repository: string;
  branch: string;
  root: string | null;
  lastCommit: string | null;
  lastCheckedAt: Date | null;
  lastPublishedCommit: string | null;
  lastPublishedReleaseId: string | null;
  connectedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getSiteSource(db: Db, siteId: string): Promise<SiteSourceRow | null> {
  const rows = await db<SiteSourceRow[]>`select * from public.site_sources where site_id = ${siteId}`;
  return rows[0] ?? null;
}

export async function forgetSiteSource(db: Db, ctx: SiteContext): Promise<void> {
  assertUploadAllowed(ctx);
  await db`delete from public.site_sources where site_id = ${ctx.site.id}`;
}

/** The organization's GitHub token for publishing this site, or null; readable only by people who may publish the site. */
export async function siteGithubToken(db: Db, siteId: string): Promise<string | null> {
  const rows = await db<{ ciphertext: string | null }[]>`select public.get_site_secret(${siteId}, 'github_token') as ciphertext`;
  const sealed = rows[0]?.ciphertext;
  return sealed ? openSecret(sealed) : null;
}

export interface GithubCheckResult extends IntakeResult {
  repository: string;
  branch: string;
  root: string | null;
  commit: string;
  isPrivate: boolean;
}

/**
 * Fetches the repository at the branch's head and takes it in like an upload; the source is
 * remembered on the site (repository, branch, folder, the commit checked).
 */
export async function checkGithubSource(db: Db, ctx: SiteContext, userId: string, input: { repository: string; branch?: string | null; root?: string | null }, opts: Pick<GithubOptions, "fetchImpl" | "apiUrl"> = {}): Promise<GithubCheckResult> {
  assertUploadAllowed(ctx);
  const parsed = parseGithubSource(input.repository, input.branch, input.root);
  const token = await siteGithubToken(db, ctx.site.id);
  const github: GithubOptions = { ...opts, token };
  const info = await githubRepositoryInfo(parsed.repository, github);
  const branch = parsed.branch || info.defaultBranch;
  const head = await githubBranchHead(info.fullName, branch, github);
  const bytes = await githubZipball(info.fullName, head.sha, github);
  const ref: GithubSourceRef = { repository: info.fullName, branch, commit: head.sha, root: parsed.root };
  const filename = `${info.fullName.replace("/", "-")}-${head.sha.slice(0, 7)}.zip`;
  const result = await registerUploadedArchive(db, ctx, userId, { filename, bytes, root: parsed.root, github: ref });
  await db`insert into public.site_sources (site_id, organization_id, kind, repository, branch, root, last_commit, last_checked_at, connected_by)
    values (${ctx.site.id}, ${ctx.site.organizationId}, 'github', ${info.fullName}, ${branch}, ${parsed.root}, ${head.sha}, now(), ${userId})
    on conflict (site_id) do update set repository = excluded.repository, branch = excluded.branch, root = excluded.root, last_commit = excluded.last_commit, last_checked_at = now(), connected_by = excluded.connected_by`;
  return { ...result, repository: info.fullName, branch, root: parsed.root, commit: head.sha, isPrivate: info.isPrivate };
}

/** After a release from GitHub is published: the source remembers the commit that is live. */
export async function markSourcePublished(db: Db, siteId: string, github: GithubSourceRef, releaseId: string): Promise<void> {
  await db`update public.site_sources set last_published_commit = ${github.commit}, last_published_release_id = ${releaseId}
    where site_id = ${siteId} and repository = ${github.repository}`;
}

export interface OrganizationSecretMeta {
  organizationId: string;
  kind: string;
  last4: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What owners may see of stored tokens: that one exists, its tail and when it was set. */
export async function listOrganizationSecrets(db: Db, organizationIds: string[]): Promise<OrganizationSecretMeta[]> {
  if (organizationIds.length === 0) return [];
  return db<OrganizationSecretMeta[]>`select organization_id, kind, last4, created_by, created_at, updated_at from public.organization_secrets where organization_id in ${db(organizationIds)}`;
}

/** Verifies the token with GitHub, then seals and stores it for the organization (owners only, enforced in SQL). */
export async function setGithubToken(db: Db, organizationId: string, token: string, opts: Pick<GithubOptions, "fetchImpl" | "apiUrl"> = {}): Promise<{ login: string; last4: string }> {
  const trimmed = token.trim();
  if (trimmed.length < 20 || trimmed.length > 400 || /\s/.test(trimmed)) throw new Error("Paste the whole token; it has no spaces and is longer than that.");
  const identity = await githubTokenIdentity(trimmed, opts);
  const last4 = secretTail(trimmed);
  await db`select public.set_organization_secret(${organizationId}, 'github_token', ${sealSecret(trimmed)}, ${last4})`;
  return { login: identity.login, last4 };
}

export async function removeGithubToken(db: Db, organizationId: string): Promise<boolean> {
  const rows = await db<{ removed: boolean }[]>`select public.delete_organization_secret(${organizationId}, 'github_token') as removed`;
  return rows[0]?.removed ?? false;
}

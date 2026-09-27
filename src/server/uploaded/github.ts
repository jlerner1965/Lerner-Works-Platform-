import { getConfig } from "@/server/config";
import { MAX_ARCHIVE_BYTES } from "./archive";

/**
 * GitHub as a source of an uploaded site (B8, decision D-027): the repository's archive is
 * fetched server-side through the REST API (no request-size wall on the way in) and read by
 * the same ZIP check as an upload. Public repositories need no token; an organization may
 * store one for private repositories. The API base is configurable so browser tests run
 * against a local stand-in.
 */

export interface GithubSourceInput {
  /** `owner/name`. */
  repository: string;
  /** Empty means the repository's default branch. */
  branch: string;
  root: string | null;
}

export interface GithubOptions {
  token?: string | null;
  fetchImpl?: typeof fetch;
  apiUrl?: string;
}

export class GithubError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/**
 * Reads what a person types as the repository: `owner/name`, a github.com address (with or
 * without `.git`, or a `/tree/<branch>/<folder>` address, which also names the branch and the
 * folder unless given separately), or the SSH form.
 */
export function parseGithubSource(repositoryInput: string, branchInput?: string | null, rootInput?: string | null): GithubSourceInput {
  let text = (repositoryInput ?? "").trim();
  let branch = (branchInput ?? "").trim();
  let root = (rootInput ?? "").trim();
  const ssh = /^git@github\.com:([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/i.exec(text);
  if (ssh) text = ssh[1]!;
  else if (/^(https?:\/\/)?(www\.)?github\.com\//i.test(text)) {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) throw new GithubError("The address must name a repository: https://github.com/<owner>/<name>.");
    text = `${parts[0]}/${parts[1]!.replace(/\.git$/i, "")}`;
    if (parts.length >= 4 && (parts[2] === "tree" || parts[2] === "blob")) {
      if (!branch) branch = decodeURIComponent(parts[3]!);
      if (!root && parts.length > 4) root = parts.slice(4).map(decodeURIComponent).join("/");
    }
  } else text = text.replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  if (!REPOSITORY.test(text)) throw new GithubError("Name the repository as owner/name or paste its github.com address.");
  if (branch.length > 200 || /[\s~^:?*[\]\\]/.test(branch)) throw new GithubError("The branch name has characters a branch cannot carry.");
  root = root.replace(/^\/+|\/+$/g, "");
  if (root.length > 200 || root.split("/").some((s) => s === "." || s === "..")) throw new GithubError("The folder must be a plain path inside the repository, such as dist or docs/site.");
  return { repository: text, branch, root: root || null };
}

function headers(opts: GithubOptions, accept = "application/vnd.github+json"): Record<string, string> {
  const h: Record<string, string> = { Accept: accept, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "LernerWorksPlatform/1.0 (+https://lernerworksplatform.dev)" };
  if (opts.token) h.Authorization = `Bearer ${opts.token}`;
  return h;
}

function apiBase(opts: GithubOptions): string {
  const base = opts.apiUrl ?? getConfig().GITHUB_API_URL;
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

async function explain(res: Response, repository: string, opts: GithubOptions): Promise<GithubError> {
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (res.status === 404) {
    return new GithubError(opts.token ? `GitHub answered 404 for ${repository}: the repository does not exist, or the stored token cannot read it.` : `GitHub answered 404 for ${repository}: the repository does not exist, or it is private and no token with access to it is stored for this organization.`, 404);
  }
  if (res.status === 401) return new GithubError("GitHub refused the stored token (401). Replace it under Organizations.", 401);
  if (res.status === 403 && remaining === "0") return new GithubError(opts.token ? "GitHub's rate limit for the stored token is used up for now; try again in a while." : "GitHub's rate limit for requests without a token is used up for now; store a token under Organizations or try again in a while.", 403);
  if (res.status === 403) return new GithubError(`GitHub refused the request for ${repository} (403).`, 403);
  return new GithubError(`GitHub answered ${res.status} for ${repository}.`, res.status);
}

async function call(path: string, repository: string, opts: GithubOptions, init: RequestInit = {}): Promise<Response> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(`${apiBase(opts)}${path}`, { ...init, headers: { ...headers(opts), ...(init.headers as Record<string, string> | undefined) }, signal: init.signal ?? AbortSignal.timeout(60_000) });
  } catch (err) {
    throw new GithubError(`GitHub could not be reached: ${err instanceof Error ? err.message : String(err)}.`);
  }
  if (!res.ok) throw await explain(res, repository, opts);
  return res;
}

export interface GithubRepositoryInfo {
  defaultBranch: string;
  isPrivate: boolean;
  fullName: string;
}

export async function githubRepositoryInfo(repository: string, opts: GithubOptions = {}): Promise<GithubRepositoryInfo> {
  const res = await call(`/repos/${repository}`, repository, opts);
  const body = (await res.json()) as { default_branch?: string; private?: boolean; full_name?: string };
  if (!body.default_branch) throw new GithubError(`GitHub's answer for ${repository} named no default branch.`);
  return { defaultBranch: body.default_branch, isPrivate: Boolean(body.private), fullName: body.full_name ?? repository };
}

export interface GithubBranchHead {
  sha: string;
  committedAt: string | null;
  message: string | null;
}

export async function githubBranchHead(repository: string, branch: string, opts: GithubOptions = {}): Promise<GithubBranchHead> {
  const res = await call(`/repos/${repository}/branches/${encodeURIComponent(branch)}`, repository, opts).catch((err) => {
    if (err instanceof GithubError && err.status === 404) throw new GithubError(`The branch "${branch}" was not found in ${repository}.`, 404);
    throw err;
  });
  const body = (await res.json()) as { commit?: { sha?: string; commit?: { message?: string; committer?: { date?: string }; author?: { date?: string } } } };
  const sha = body.commit?.sha;
  if (!sha || !/^[0-9a-f]{7,64}$/i.test(sha)) throw new GithubError(`GitHub's answer for ${repository}@${branch} named no commit.`);
  return { sha, committedAt: body.commit?.commit?.committer?.date ?? body.commit?.commit?.author?.date ?? null, message: body.commit?.commit?.message?.split("\n")[0]?.slice(0, 200) ?? null };
}

/** The repository at a commit as a ZIP, capped at the archive limit. */
export async function githubZipball(repository: string, ref: string, opts: GithubOptions = {}): Promise<Uint8Array> {
  const res = await call(`/repos/${repository}/zipball/${encodeURIComponent(ref)}`, repository, opts, { headers: { Accept: "application/octet-stream, */*" } });
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_ARCHIVE_BYTES) throw new GithubError(`The repository's archive is ${(declared / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB.`);
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ARCHIVE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new GithubError(`The repository's archive is larger than ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB.`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Who a token belongs to; a refused token is an error. */
export async function githubTokenIdentity(token: string, opts: GithubOptions = {}): Promise<{ login: string }> {
  const res = await call("/user", "the token", { ...opts, token }).catch((err) => {
    if (err instanceof GithubError && (err.status === 401 || err.status === 403)) throw new GithubError("GitHub did not accept the token. Create a fine-grained token with read access to Contents of the repositories you publish from, and paste it whole.", err.status);
    throw err;
  });
  const body = (await res.json()) as { login?: string };
  if (!body.login) throw new GithubError("GitHub did not say whose token this is.");
  return { login: body.login };
}

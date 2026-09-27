import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { GithubError, githubBranchHead, githubRepositoryInfo, githubTokenIdentity, githubZipball, parseGithubSource } from "@/server/uploaded/github";
import { MAX_ARCHIVE_BYTES } from "@/server/uploaded/archive";

/**
 * Publish from GitHub (B8): how a repository is named, and how the API is spoken to, with a
 * fetch stand-in. No network.
 */
type Handler = (req: { path: string; headers: Headers }) => Response;

function fakeFetch(routes: Record<string, Handler>, seen: Array<{ path: string; headers: Headers }> = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = new Headers(init?.headers);
    seen.push({ path: url.pathname, headers });
    const handler = routes[url.pathname];
    return handler ? handler({ path: url.pathname, headers }) : new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
  }) as typeof fetch;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const api = { apiUrl: "https://github.example/api" };

describe("naming a repository", () => {
  it("accepts owner/name, github.com addresses with or without .git, tree addresses with their branch and folder, and the SSH form", () => {
    expect(parseGithubSource("harbor/site")).toEqual({ repository: "harbor/site", branch: "", root: null });
    expect(parseGithubSource("https://github.com/harbor/site")).toEqual({ repository: "harbor/site", branch: "", root: null });
    expect(parseGithubSource("https://github.com/harbor/site.git/")).toEqual({ repository: "harbor/site", branch: "", root: null });
    expect(parseGithubSource("github.com/harbor/site")).toEqual({ repository: "harbor/site", branch: "", root: null });
    expect(parseGithubSource("https://github.com/harbor/site/tree/main/docs/site")).toEqual({ repository: "harbor/site", branch: "main", root: "docs/site" });
    expect(parseGithubSource("https://github.com/harbor/site/tree/main/docs/site", "release", "/dist/")).toEqual({ repository: "harbor/site", branch: "release", root: "dist" });
    expect(parseGithubSource("git@github.com:harbor/site.git")).toEqual({ repository: "harbor/site", branch: "", root: null });
    expect(parseGithubSource("  harbor/site.git ", " main ", "")).toEqual({ repository: "harbor/site", branch: "main", root: null });
  });

  it("refuses what is not a repository, a branch with impossible characters and a folder that leaves the repository", () => {
    expect(() => parseGithubSource("harbor")).toThrow(/owner\/name/);
    expect(() => parseGithubSource("https://gitlab.com/harbor/site")).toThrow(/owner\/name/);
    expect(() => parseGithubSource("https://github.com/harbor")).toThrow(/must name a repository/);
    expect(() => parseGithubSource("harbor/site", "bad branch")).toThrow(/branch/);
    expect(() => parseGithubSource("harbor/site", "main", "../etc")).toThrow(/folder/);
  });
});

describe("speaking to GitHub", () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";

  it("reads the repository, the branch head and the archive, sending the token when there is one", async () => {
    const zip = zipSync({ "harbor-site-0123456/index.html": strToU8("<p>hi</p>") });
    const seen: Array<{ path: string; headers: Headers }> = [];
    const fetchImpl = fakeFetch(
      {
        "/api/repos/harbor/site": () => json({ default_branch: "main", private: true, full_name: "harbor/site" }),
        "/api/repos/harbor/site/branches/main": () => json({ commit: { sha, commit: { message: "Second version\n\nmore", committer: { date: "2026-09-27T00:00:00Z" } } } }),
        [`/api/repos/harbor/site/zipball/${sha}`]: () => new Response(zip, { status: 200, headers: { "content-type": "application/zip", "content-length": String(zip.byteLength) } }),
      },
      seen,
    );
    const opts = { ...api, fetchImpl, token: "github_pat_test" };
    expect(await githubRepositoryInfo("harbor/site", opts)).toEqual({ defaultBranch: "main", isPrivate: true, fullName: "harbor/site" });
    expect(await githubBranchHead("harbor/site", "main", opts)).toEqual({ sha, committedAt: "2026-09-27T00:00:00Z", message: "Second version" });
    const bytes = await githubZipball("harbor/site", sha, opts);
    expect(bytes.byteLength).toBe(zip.byteLength);
    expect(seen.map((s) => s.path)).toEqual(["/api/repos/harbor/site", "/api/repos/harbor/site/branches/main", `/api/repos/harbor/site/zipball/${sha}`]);
    for (const s of seen) {
      expect(s.headers.get("authorization")).toBe("Bearer github_pat_test");
      expect(s.headers.get("user-agent")).toMatch(/LernerWorksPlatform/);
      expect(s.headers.get("x-github-api-version")).toBe("2022-11-28");
    }
  });

  it("explains a missing or private repository, a refused token, an exhausted rate limit, a missing branch and an archive over the limit", async () => {
    const without = { ...api, fetchImpl: fakeFetch({}) };
    await expect(githubRepositoryInfo("harbor/nope", without)).rejects.toThrow(/does not exist, or it is private and no token/);
    const withToken = { ...api, token: "t", fetchImpl: fakeFetch({}) };
    await expect(githubRepositoryInfo("harbor/nope", withToken)).rejects.toThrow(/the stored token cannot read it/);
    await expect(githubRepositoryInfo("harbor/site", { ...api, token: "bad", fetchImpl: fakeFetch({ "/api/repos/harbor/site": () => json({ message: "Bad credentials" }, 401) }) })).rejects.toThrow(/refused the stored token/);
    await expect(githubRepositoryInfo("harbor/site", { ...api, fetchImpl: fakeFetch({ "/api/repos/harbor/site": () => json({ message: "rate" }, 403, { "x-ratelimit-remaining": "0" }) }) })).rejects.toThrow(/rate limit for requests without a token/);
    await expect(githubBranchHead("harbor/site", "gone", { ...api, fetchImpl: fakeFetch({}) })).rejects.toThrow('The branch "gone" was not found in harbor/site.');
    const big = { ...api, fetchImpl: fakeFetch({ [`/api/repos/harbor/site/zipball/${sha}`]: () => new Response("x", { status: 200, headers: { "content-length": String(MAX_ARCHIVE_BYTES + 1) } }) }) };
    await expect(githubZipball("harbor/site", sha, big)).rejects.toThrow(/the limit is 64 MB/);
    const unreachable = { ...api, fetchImpl: (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch };
    await expect(githubRepositoryInfo("harbor/site", unreachable)).rejects.toThrow(/could not be reached: ECONNREFUSED/);
    const err = await githubRepositoryInfo("harbor/nope", without).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GithubError);
    expect((err as GithubError).status).toBe(404);
  });

  it("tells whose token it is, and says how to make one when GitHub refuses it", async () => {
    const good = fakeFetch({ "/api/user": ({ headers }) => (headers.get("authorization") === "Bearer github_pat_ok" ? json({ login: "harbor-bot" }) : json({ message: "Bad credentials" }, 401)) });
    expect(await githubTokenIdentity("github_pat_ok", { ...api, fetchImpl: good })).toEqual({ login: "harbor-bot" });
    await expect(githubTokenIdentity("nope", { ...api, fetchImpl: good })).rejects.toThrow(/fine-grained token with read access to Contents/);
  });
});

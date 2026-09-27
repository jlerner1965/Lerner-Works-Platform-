import http from "node:http";
import { strToU8, zipSync } from "fflate";
import { sampleUploadedSiteFiles } from "../../src/server/demo/uploaded-sample";

/**
 * A stand-in for the GitHub REST API used by the browser tests (B8): one public repository,
 * one private repository that needs the token, and /user for storing the token. The
 * application under test points GITHUB_API_URL at it (scripts/e2e-server.ts).
 */
export const FAKE_GITHUB_PORT = 3199;
export const FAKE_GITHUB_TOKEN = "github_pat_e2e_ABCDEFGHIJKLMNOPQRST_4321";
export const FAKE_GITHUB_SHA = "89abcdef0123456789abcdef0123456789abcdef";

function repoZip(prefix: string, headline: string): Uint8Array {
  const files = sampleUploadedSiteFiles();
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [`${prefix}/${name}`, strToU8(name === "index.html" ? text.replace("Furniture made to be handed down.", headline) : text)])));
}

export const FAKE_GITHUB_HEADLINES = { public: "Published from GitHub.", private: "From the private repository." };

export function startFakeGithub(port = FAKE_GITHUB_PORT): Promise<http.Server> {
  const publicZip = repoZip("harbor-site-89abcde", FAKE_GITHUB_HEADLINES.public);
  const privateZip = repoZip("harbor-private-site-89abcde", FAKE_GITHUB_HEADLINES.private);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const auth = req.headers.authorization ?? "";
    const json = (body: unknown, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const p = url.pathname;
    if (p === "/user") return auth === `Bearer ${FAKE_GITHUB_TOKEN}` ? json({ login: "harbor-bot" }) : json({ message: "Bad credentials" }, 401);
    const isPrivate = p.startsWith("/repos/harbor/private-site");
    if (isPrivate && auth !== `Bearer ${FAKE_GITHUB_TOKEN}`) return json({ message: "Not Found" }, 404);
    const repo = isPrivate ? "harbor/private-site" : "harbor/site";
    if (p === `/repos/${repo}`) return json({ default_branch: "main", private: isPrivate, full_name: repo });
    if (p === `/repos/${repo}/branches/main`) return json({ commit: { sha: FAKE_GITHUB_SHA, commit: { message: "Latest", committer: { date: "2026-09-27T00:00:00Z" } } } });
    if (p === `/repos/${repo}/zipball/${FAKE_GITHUB_SHA}`) {
      const zip = isPrivate ? privateZip : publicZip;
      res.writeHead(200, { "content-type": "application/zip", "content-length": String(zip.byteLength) });
      return res.end(Buffer.from(zip));
    }
    return json({ message: "Not Found" }, 404);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

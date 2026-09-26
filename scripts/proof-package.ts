/**
 * Writes the onboarding package of a proof site (site-building programme B4) so it can be
 * imported on any site created from the same preset: locally for the timed dashboard build,
 * or on production by the owner (Import & export → Onboarding package → dry run → confirm).
 *
 *   pnpm proof:package --site cedar-bend [--out cedar-bend-package.zip]
 *   pnpm proof:package --list
 *
 * The package carries the sheets and the photographs committed under
 * `src/server/demo/proof/photos/<site>/` (fetched by scripts/fetch-proof-photos.ts).
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main(): Promise<void> {
  const { proofSites, buildProofPackage, proofPhotoProblems, proofPhotoDir } = await import("@/server/demo/proof");
  if (args.includes("--list")) {
    for (const s of proofSites) console.log(`${s.key}\t${s.name}\t${s.preset}\t${s.photos.length} photographs`);
    return;
  }
  const key = opt("site");
  const site = proofSites.find((s) => s.key === key);
  if (!site) throw new Error(`usage: proof-package.ts --site <${proofSites.map((s) => s.key).join(" | ")}> [--out file.zip]`);
  const problems = proofPhotoProblems(site);
  if (problems.length) throw new Error(`${site.key} is not consistent:\n- ${problems.join("\n- ")}`);
  const dir = proofPhotoDir(site.key);
  const missing = site.photos.filter((p) => !fs.existsSync(path.join(dir, p.file)));
  if (missing.length) throw new Error(`${missing.length} photograph(s) missing under ${dir}; run scripts/fetch-proof-photos.ts first (${missing.map((p) => p.file).join(", ")})`);
  const bytes = await buildProofPackage(site, (file) => new Uint8Array(fs.readFileSync(path.join(dir, file))));
  const out = opt("out") ?? `${site.key}-package.zip`;
  fs.writeFileSync(out, bytes);
  const rows = Object.values(site.rows).reduce((n, r) => n + (r?.length ?? 0), 0);
  console.log(`${out}: ${Math.round(bytes.byteLength / 1024)} KiB, ${rows} row(s), ${site.photos.length} photograph(s), ${Object.keys(site.settings).length} setting(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

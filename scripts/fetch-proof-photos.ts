/**
 * Fetches the proof sites' photographs from the Library of Congress image service and writes
 * the web-sized JPEGs the packages carry (site-building programme B4). Every photograph is
 * declared in `src/server/demo/proof/` with its archive id, catalogue URL and title; this
 * script is the reproducible way the committed files under
 * `src/server/demo/proof/photos/<site>/` were made, and it fetches only what is missing.
 *
 *   pnpm exec tsx scripts/fetch-proof-photos.ts [--site cedar-bend] [--force]
 *
 * The originals are large TIFF scans; the service's quarter-size JPEG (about 2200 pixels
 * wide) is fetched and reduced to 1800 pixels on the long edge at JPEG quality 82 with the
 * metadata stripped, the same limits the media pipeline applies to an upload.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const force = args.includes("--force");
const USER_AGENT = "LernerWorksPlatform/1.0 (proof-site photography; see docs/evidence/ASSETS.md)";
const LONG_EDGE = 1800;

async function main(): Promise<void> {
  const { proofSites } = await import("@/server/demo/proof");
  const { locImageUrl, proofPhotoDir } = await import("@/server/demo/proof");
  const { default: sharp } = await import("sharp");
  const only = opt("site");
  let fetched = 0;
  let kept = 0;
  for (const site of proofSites) {
    if (only && site.key !== only) continue;
    const dir = proofPhotoDir(site.key);
    fs.mkdirSync(dir, { recursive: true });
    for (const photo of site.photos) {
      const target = path.join(dir, photo.file);
      if (!force && fs.existsSync(target) && fs.statSync(target).size > 0) {
        kept++;
        continue;
      }
      const url = locImageUrl(photo.loc);
      const tmp = `${target}.download`;
      let ok = false;
      for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        try {
          execFileSync("curl", ["-sS", "--fail", "--max-time", "120", "-A", USER_AGENT, "-o", tmp, url], { stdio: "pipe" });
          ok = fs.existsSync(tmp) && fs.statSync(tmp).size > 10_000;
        } catch (error) {
          console.error(`${site.key}/${photo.file}: attempt ${attempt} failed (${error instanceof Error ? error.message.split("\n")[0] : String(error)})`);
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
      }
      if (!ok) throw new Error(`could not fetch ${photo.loc} for ${site.key}/${photo.file}`);
      const image = sharp(tmp).rotate();
      const meta = await image.metadata();
      const landscape = (meta.width ?? 0) >= (meta.height ?? 0);
      await image
        .resize(landscape ? { width: LONG_EDGE, withoutEnlargement: true } : { height: LONG_EDGE, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(target);
      fs.rmSync(tmp, { force: true });
      const out = await sharp(target).metadata();
      console.log(`${site.key}/${photo.file}: ${photo.loc} → ${out.width}×${out.height}, ${Math.round(fs.statSync(target).size / 1024)} KiB`);
      fetched++;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  console.log(`${fetched} photograph(s) fetched, ${kept} already present.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

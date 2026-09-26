/**
 * Compares two directories of screenshots pixel by pixel (design programme principle 3: a
 * renderer change must leave existing releases looking the same unless the change is
 * intended). For every PNG present in both directories it reports the share of pixels that
 * differ by more than a small per-channel tolerance and the height difference; with --out it
 * writes a highlighted difference image for every pair above the threshold.
 *
 *   pnpm exec tsx scripts/screenshot-diff.ts --before docs/evidence/screenshots --after /tmp/shots [--out /tmp/diffs] [--threshold 0.5]
 *
 * Exit code 1 when any pair differs by more than the threshold (percent of the compared area)
 * or has a different size, so the comparison can gate a script.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const before = opt("before");
const after = opt("after");
if (!before || !after) {
  console.error("usage: screenshot-diff --before <dir> --after <dir> [--out <dir>] [--threshold <percent>]");
  process.exit(2);
}
const outDir = opt("out");
const threshold = Number(opt("threshold") ?? "0.5");
const tolerance = 24; // per-channel difference treated as identical (anti-aliasing, font hinting)

interface Row { name: string; sizeBefore: string; sizeAfter: string; differentPercent: number; differentPixels: number; comparedPixels: number }

async function compare(name: string): Promise<Row> {
  const a = sharp(path.join(before!, name)).ensureAlpha();
  const b = sharp(path.join(after!, name)).ensureAlpha();
  const [ma, mb] = await Promise.all([a.metadata(), b.metadata()]);
  const width = Math.min(ma.width!, mb.width!);
  const height = Math.min(ma.height!, mb.height!);
  const [ra, rb] = await Promise.all([
    a.extract({ left: 0, top: 0, width, height }).raw().toBuffer(),
    b.extract({ left: 0, top: 0, width, height }).raw().toBuffer(),
  ]);
  const diff = outDir ? Buffer.alloc(width * height * 4) : null;
  let different = 0;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const d = Math.max(Math.abs(ra[o]! - rb[o]!), Math.abs(ra[o + 1]! - rb[o + 1]!), Math.abs(ra[o + 2]! - rb[o + 2]!));
    const changed = d > tolerance;
    if (changed) different++;
    if (diff) {
      // Faded "after" image with changed pixels in solid red.
      const grey = Math.round((rb[o]! + rb[o + 1]! + rb[o + 2]!) / 3);
      const base = 160 + Math.round(grey * 0.35);
      diff[o] = changed ? 220 : base;
      diff[o + 1] = changed ? 30 : base;
      diff[o + 2] = changed ? 30 : base;
      diff[o + 3] = 255;
    }
  }
  const row: Row = { name, sizeBefore: `${ma.width}×${ma.height}`, sizeAfter: `${mb.width}×${mb.height}`, differentPercent: (different / (width * height)) * 100, differentPixels: different, comparedPixels: width * height };
  if (diff && (row.differentPercent > threshold || row.sizeBefore !== row.sizeAfter)) {
    fs.mkdirSync(outDir!, { recursive: true });
    await sharp(diff, { raw: { width, height, channels: 4 } }).png().toFile(path.join(outDir!, name.replace(/\.png$/, "-diff.png")));
  }
  return row;
}

async function main(): Promise<void> {
  const names = fs.readdirSync(before!).filter((f) => f.endsWith(".png") && fs.existsSync(path.join(after!, f))).sort();
  if (names.length === 0) {
    console.error("no screenshots with the same name in both directories");
    process.exit(2);
  }
  const rows: Row[] = [];
  for (const name of names) rows.push(await compare(name));
  console.log("screenshot                      before        after         differing");
  let failed = false;
  for (const r of rows) {
    const flag = r.sizeBefore !== r.sizeAfter || r.differentPercent > threshold;
    if (flag) failed = true;
    console.log(`${r.name.padEnd(32)}${r.sizeBefore.padEnd(14)}${r.sizeAfter.padEnd(14)}${r.differentPercent.toFixed(2).padStart(6)} %${flag ? "  <-- review" : ""}`);
  }
  console.log(`${rows.length} pairs compared; tolerance ${tolerance}/255 per channel; threshold ${threshold} % of the compared area`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Responsive screenshot pass over the two pilot sites (evidence for UX-02 and the design
 * programme). Captures every listed public page at 390, 768 and 1440 CSS pixels into
 * docs/evidence/screenshots/<name>-<width>.png, and fails when a page overflows horizontally
 * or logs a console error.
 *
 *   pnpm exec tsx scripts/screenshots.ts --base http://127.0.0.1:3100 [--only guide-home,retail-home]
 *
 * The server must be running against a database seeded with the demonstration fixtures
 * (`pnpm seed:demo`, or the e2e server started by `pnpm exec tsx scripts/e2e-server.ts`).
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const base = (opt("base") ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const only = opt("only")?.split(",").map((s) => s.trim()).filter(Boolean);
const outDir = opt("out") ?? "docs/evidence/screenshots";
const widths = [390, 768, 1440];
// Same browser resolution as playwright.config.ts: an explicit path, else a pre-installed Chromium.
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ?? ["/opt/pw-browsers/chromium/chrome-linux/chrome", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));

const pages: Array<{ name: string; path: string }> = [
  { name: "guide-home", path: "/demo/pine-hollow" },
  { name: "guide-directory", path: "/demo/pine-hollow/places" },
  { name: "guide-place", path: "/demo/pine-hollow/places/creekside-coffee-roasters" },
  { name: "guide-events", path: "/demo/pine-hollow/events" },
  { name: "guide-event", path: "/demo/pine-hollow/events/harvest-market-on-aspen-street" },
  { name: "guide-article", path: "/demo/pine-hollow/articles/how-pine-hollow-keeps-its-trailheads-open" },
  { name: "guide-contact", path: "/demo/pine-hollow/contact" },
  { name: "guide-about", path: "/demo/pine-hollow/about" },
  { name: "guide-search", path: "/demo/pine-hollow/search?q=coffee" },
  { name: "retail-home", path: "/demo/range-athletics" },
  { name: "retail-locations", path: "/demo/range-athletics/locations" },
  { name: "retail-closed-store", path: "/demo/range-athletics/locations/fort-collins" },
  { name: "retail-service", path: "/demo/range-athletics/services/ski-and-snowboard-tuning" },
  { name: "retail-contact", path: "/demo/range-athletics/contact" },
  { name: "retail-about", path: "/demo/range-athletics/about" },
];

async function main(): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const rows: Array<{ name: string; width: number; status: number; overflow: boolean; errors: number; file: string }> = [];
  let failed = false;
  try {
    for (const p of pages) {
      if (only && !only.includes(p.name)) continue;
      for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
        page.on("pageerror", (e) => errors.push(e.message));
        const response = await page.goto(`${base}${p.path}`, { waitUntil: "networkidle" });
        const status = response?.status() ?? 0;
        await page.evaluate(() => document.fonts.ready);
        // Walk down the page so lazily loaded images below the fold are fetched before the capture.
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 40));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        const file = path.join(outDir, `${p.name}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        rows.push({ name: p.name, width, status, overflow, errors: errors.length, file });
        if (status !== 200 || overflow || errors.length) {
          failed = true;
          for (const e of errors) console.error(`  ${p.name}@${width}: console error: ${e}`);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log("page                  width  status  overflow  console-errors");
  for (const r of rows) console.log(`${r.name.padEnd(22)}${String(r.width).padEnd(7)}${String(r.status).padEnd(8)}${String(r.overflow).padEnd(10)}${r.errors}`);
  console.log(`${rows.length} screenshots written to ${outDir}`);
  if (failed) {
    console.error("Screenshot pass FAILED: a page did not return 200, overflowed horizontally or logged an error.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

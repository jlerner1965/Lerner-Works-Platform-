import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Fonts are loaded by the Next.js build; here each family only needs its variable class name.
vi.mock("next/font/local", () => ({
  default: (opts: { variable?: string }) => ({ className: "font-mock", variable: `${(opts.variable ?? "--font").replace(/^--/, "")}-mock`, style: {} }),
}));

import { getTheme } from "@/themes";
import { normalizeSnapshot } from "@/server/publishing/snapshot";
import { resolveRoute } from "@/server/publishing/public-site";
import { makeRenderContext } from "@/server/publishing/render";
import { sha256Hex } from "@/lib/canonical-json";

/**
 * Rendering-hash test (design programme principle 3, DES-09). Every route of the frozen
 * pilot releases in tests/fixtures/releases/ is rendered with a fixed clock and hashed. A
 * code change that alters the output of an existing release fails here, so the change is
 * reviewed on purpose rather than shipped by accident. To accept a reviewed change:
 *   UPDATE_RENDERING_HASHES=1 pnpm exec vitest run --project unit tests/unit/rendering-hash.test.ts
 * and record the reason in docs/PROGRESS.md. New fixtures come from
 * scripts/export-release-fixtures.ts.
 */
const dir = path.resolve("tests/fixtures/releases");
const hashesFile = path.join(dir, "hashes.json");
const update = process.env.UPDATE_RENDERING_HASHES === "1";
const fixtures = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "hashes.json").sort() : [];
const recorded: Record<string, Record<string, string>> = fs.existsSync(hashesFile) ? JSON.parse(fs.readFileSync(hashesFile, "utf8")) : {};
const clock = new Date("2026-09-26T12:00:00Z");

function renderFixture(file: string): Record<string, string> {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as unknown;
  const snapshot = normalizeSnapshot(raw);
  if (!snapshot) throw new Error(`${file} is not a supported snapshot`);
  const theme = getTheme(snapshot.site.preset);
  const basePath = `/demo/${snapshot.site.key}`;
  const out: Record<string, string> = {};
  for (const route of [...snapshot.routes].sort((a, b) => a.path.localeCompare(b.path))) {
    const ctx = makeRenderContext({ snapshot, basePath, mode: "demo", path: route.path, query: {}, inquiryEndpoint: `${basePath}/inquiries`, releaseVersion: 1, publishedAt: clock, now: clock });
    const html = renderToStaticMarkup(theme.render(ctx, resolveRoute(snapshot, route.path)));
    if (!html || html.length < 500) throw new Error(`${file} ${route.path} rendered ${html.length} bytes`);
    out[route.path] = sha256Hex(html);
  }
  return out;
}

describe("rendering hashes of frozen releases", () => {
  it("has fixtures for both pilots", () => {
    expect(fixtures.some((f) => f.startsWith("pine-hollow-"))).toBe(true);
    expect(fixtures.some((f) => f.startsWith("range-athletics-"))).toBe(true);
  });

  const results: Record<string, Record<string, string>> = {};
  for (const file of fixtures) {
    it(`renders every route of ${file} exactly as recorded`, () => {
      const hashes = renderFixture(file);
      results[file] = hashes;
      if (update) return;
      const expected = recorded[file];
      expect(expected, `${file} has no recorded hashes; run with UPDATE_RENDERING_HASHES=1`).toBeDefined();
      for (const [route, hash] of Object.entries(hashes)) {
        expect(hash, `Rendering of ${file} at ${route} changed. If this is an intended theme change, review the page and re-record with UPDATE_RENDERING_HASHES=1 (note the reason in docs/PROGRESS.md).`).toBe(expected![route]);
      }
      expect(Object.keys(hashes).sort()).toEqual(Object.keys(expected!).sort());
    });
  }

  it("records the hashes when asked to", () => {
    if (!update) return;
    fs.writeFileSync(hashesFile, JSON.stringify(results, null, 1) + "\n");
    expect(Object.keys(results)).toEqual(fixtures);
  });
});

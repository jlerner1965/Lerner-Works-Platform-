/**
 * Exports the active release snapshots of the two pilot sites from the local development
 * database into tests/fixtures/releases/, as frozen inputs for the rendering-hash test
 * (`tests/unit/rendering-hash.test.ts`), named by snapshot schema version. Existing fixtures of
 * other versions stay in place, so every past release format remains covered as the pilots
 * are re-composed. The first export of a site also derives a schema-version-1 copy (the
 * configuration fields added by design phase D0 removed); an existing version-1 fixture is
 * never overwritten, because later compositions use section types a version-1 release could
 * not contain.
 *
 *   pnpm exec tsx scripts/export-release-fixtures.ts
 *
 * Local only: it reads the development database named by DATABASE_ADMIN_URL with APP_ENV=local.
 * After exporting, re-record the hashes:
 *   UPDATE_RENDERING_HASHES=1 pnpm exec vitest run --project unit tests/unit/rendering-hash.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { loadEnv } from "./lib/env";

loadEnv();
if (process.env.APP_ENV !== "local") {
  console.error("export-release-fixtures runs only with APP_ENV=local");
  process.exit(1);
}
const url = process.env.DATABASE_ADMIN_URL;
if (!url) {
  console.error("DATABASE_ADMIN_URL is not configured; run pnpm db:start");
  process.exit(1);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = sortValue((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

/** A schema-version-1 snapshot: the shape releases had before design phase D0. */
function toVersionOne(snapshot: Record<string, unknown>): Record<string, unknown> {
  const s = structuredClone(snapshot) as Record<string, unknown> & { config: Record<string, unknown> };
  const config = s.config;
  const navigation = { ...(config.navigation as Record<string, unknown>) };
  delete navigation.showSearch;
  const footer = { ...(config.footer as Record<string, unknown>) };
  delete footer.variant;
  const metadata = { ...(config.metadata as Record<string, unknown>) };
  delete metadata.language;
  delete metadata.faviconAssetId;
  delete metadata.shareImageAssetId;
  const next = { ...config, navigation, footer, metadata } as Record<string, unknown>;
  delete next.indexes;
  delete next.design;
  s.config = next;
  s.schemaVersion = 1;
  return s;
}

async function main(): Promise<void> {
  const sql = postgres(url!, { max: 1, onnotice: () => {}, transform: postgres.camel });
  try {
    const rows = await sql<Array<{ key: string; schemaVersion: number; version: number; snapshot: Record<string, unknown> }>>`
      select s.key, r.schema_version, r.version, r.snapshot from public.sites s join public.releases r on r.id = s.active_release_id
      where s.key in ('pine-hollow', 'range-athletics') order by s.key`;
    if (rows.length !== 2) throw new Error(`expected both pilots to have an active release, found ${rows.length}`);
    const dir = path.resolve("tests/fixtures/releases");
    fs.mkdirSync(dir, { recursive: true });
    for (const row of rows) {
      const file = path.join(dir, `${row.key}-v${row.schemaVersion}.json`);
      fs.writeFileSync(file, JSON.stringify(sortValue(row.snapshot), null, 1) + "\n");
      console.log(`${path.relative(process.cwd(), file)}: release ${row.version}, ${Object.keys(row.snapshot.items as object).length} items`);
      if (row.schemaVersion !== 1) {
        const v1 = path.join(dir, `${row.key}-v1.json`);
        if (fs.existsSync(v1)) {
          console.log(`${path.relative(process.cwd(), v1)}: kept (existing schema-version-1 fixture)`);
        } else {
          fs.writeFileSync(v1, JSON.stringify(sortValue(toVersionOne(row.snapshot)), null, 1) + "\n");
          console.log(`${path.relative(process.cwd(), v1)}: derived schema-version-1 copy`);
        }
      }
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

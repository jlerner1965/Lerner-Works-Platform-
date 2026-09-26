/**
 * Restore rehearsal: restores a local backup into a NEW local database (lernerworks_restore_test)
 * and a copied storage directory, then verifies that records and referenced assets resolve.
 * Usage: pnpm exec tsx scripts/restore-rehearsal.ts .data/backups/<timestamp>
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { loadEnv, requireEnv, projectRoot, assertSafeLocalTarget } from "./lib/env";

loadEnv();

async function main(): Promise<void> {
  const backupDir = process.argv[2];
  if (!backupDir || !fs.existsSync(path.join(backupDir, "database.dump"))) {
    console.error("Usage: pnpm exec tsx scripts/restore-rehearsal.ts .data/backups/<timestamp>");
    process.exit(1);
  }
  const adminUrl = requireEnv("DATABASE_ADMIN_URL");
  const target = new URL(adminUrl);
  target.pathname = "/lernerworks_restore_test";
  assertSafeLocalTarget(target.toString(), "Restore rehearsal");
  const maintenance = new URL(adminUrl);
  maintenance.pathname = "/postgres";
  const sql = postgres(maintenance.toString(), { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`drop database if exists lernerworks_restore_test`);
    await sql.unsafe(`create database lernerworks_restore_test owner "${decodeURIComponent(target.username)}"`);
  } finally {
    await sql.end();
  }
  console.log("Restoring database dump into lernerworks_restore_test ...");
  execFileSync("pg_restore", ["--no-owner", "--no-privileges", "--dbname", target.toString(), path.join(backupDir, "database.dump")], { stdio: "inherit" });
  const storageTar = path.join(backupDir, "storage.tar");
  const restoredStorage = path.join(projectRoot, ".data", "restore-rehearsal-storage");
  fs.rmSync(restoredStorage, { recursive: true, force: true });
  fs.mkdirSync(restoredStorage, { recursive: true });
  if (fs.existsSync(storageTar)) execFileSync("tar", ["-xf", storageTar, "-C", restoredStorage], { stdio: "inherit" });
  const restored = postgres(target.toString(), { max: 1, onnotice: () => {}, transform: postgres.camel });
  try {
    const [counts] = await restored<{ sites: number; items: number; releases: number; media: number; inquiries: number }[]>`
      select (select count(*)::int from public.sites) as sites, (select count(*)::int from public.content_items) as items,
        (select count(*)::int from public.releases) as releases, (select count(*)::int from public.media_assets) as media,
        (select count(*)::int from public.inquiries) as inquiries`;
    const assets = await restored<{ derivatives: Record<string, { key: string }> }[]>`select derivatives from public.media_assets where status = 'ready'`;
    let present = 0;
    let missing = 0;
    const root = path.join(restoredStorage, "storage", "private");
    for (const a of assets) {
      for (const d of Object.values(a.derivatives)) {
        if (fs.existsSync(path.join(root, ...d.key.split("/")))) present++;
        else missing++;
      }
    }
    console.log(`Restored: ${JSON.stringify(counts)}; derivatives present ${present}, missing ${missing}.`);
    if (missing > 0) process.exitCode = 2;
  } finally {
    await restored.end();
  }
  console.log("Rehearsal database lernerworks_restore_test and .data/restore-rehearsal-storage are left in place for inspection.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

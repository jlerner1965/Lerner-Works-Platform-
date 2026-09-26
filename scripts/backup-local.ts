/**
 * Local backup: pg_dump of the development database plus a tar of the local storage tree.
 * Output goes to .data/backups/<timestamp>/. Site export is portability; this is recovery.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadEnv, requireEnv, projectRoot, redactUrl } from "./lib/env";

loadEnv();

const url = requireEnv("DATABASE_ADMIN_URL");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = path.join(projectRoot, ".data", "backups", stamp);
fs.mkdirSync(dir, { recursive: true });
const dumpFile = path.join(dir, "database.dump");
console.log(`Dumping ${redactUrl(url)} → ${path.relative(projectRoot, dumpFile)}`);
execFileSync("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", dumpFile, url], { stdio: "inherit" });
const storageDir = path.resolve(projectRoot, process.env.STORAGE_LOCAL_DIR ?? ".data/storage");
if (fs.existsSync(storageDir)) {
  const tarFile = path.join(dir, "storage.tar");
  execFileSync("tar", ["-cf", tarFile, "-C", path.dirname(storageDir), path.basename(storageDir)], { stdio: "inherit" });
  console.log(`Storage archived → ${path.relative(projectRoot, tarFile)}`);
} else {
  console.log("No local storage directory found; nothing archived.");
}
fs.writeFileSync(path.join(dir, "MANIFEST.txt"), `Lerner Works local backup\nCreated: ${new Date().toISOString()}\nDatabase: ${redactUrl(url)}\nStorage: ${storageDir}\n`);
console.log(`Backup complete: ${path.relative(projectRoot, dir)}`);

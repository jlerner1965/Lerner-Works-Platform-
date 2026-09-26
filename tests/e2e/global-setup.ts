import { execFileSync } from "node:child_process";
import fs from "node:fs";

const TEST_PASSWORD = "correct-horse-battery-staple-2026";

/**
 * Resets and seeds the isolated test database through the repository's own scripts (run as
 * subprocesses so Playwright's loader never has to resolve application path aliases).
 */
export default async function globalSetup(): Promise<void> {
  fs.mkdirSync("tests/e2e/.auth", { recursive: true });
  execFileSync("pnpm", ["exec", "tsx", "scripts/db-reset.ts", "--test", "--yes"], { stdio: "inherit" });
  execFileSync("pnpm", ["exec", "tsx", "scripts/seed-demo.ts", "--test", "--out", "tests/e2e/.auth/seed.json"], {
    stdio: "inherit",
    env: { ...process.env, SEED_FIXED_PASSWORD: TEST_PASSWORD },
  });
  fs.rmSync(".data/test-storage", { recursive: true, force: true });
}

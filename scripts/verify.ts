/**
 * Release gate: runs the documented checks in order and fails on the first unmet required
 * check. Use --skip-e2e or --skip-build to shorten local runs (the full gate runs everything).
 */
import { spawnSync } from "node:child_process";

const skipE2e = process.argv.includes("--skip-e2e");
const skipBuild = process.argv.includes("--skip-build");

const steps: Array<{ name: string; args: string[]; required: boolean; skip?: boolean }> = [
  { name: "Setup check", args: ["setup:check"], required: true },
  { name: "Lint", args: ["lint"], required: true },
  { name: "Typecheck", args: ["typecheck"], required: true },
  { name: "Unit tests", args: ["test"], required: true },
  { name: "Integration tests (isolated test database)", args: ["test:integration"], required: true },
  { name: "Browser tests (isolated test database)", args: ["test:e2e"], required: true, skip: skipE2e },
  { name: "Production build", args: ["build"], required: true, skip: skipBuild },
];

const results: Array<{ name: string; status: "PASS" | "FAIL" | "SKIPPED"; seconds: number }> = [];
let failed = false;
for (const step of steps) {
  if (step.skip) {
    results.push({ name: step.name, status: "SKIPPED", seconds: 0 });
    continue;
  }
  if (failed) {
    results.push({ name: step.name, status: "SKIPPED", seconds: 0 });
    continue;
  }
  console.log(`\n=== ${step.name} ===`);
  const start = Date.now();
  const r = spawnSync("pnpm", step.args, { stdio: "inherit", env: { ...process.env, NEXT_DIST_DIR: step.args[0] === "build" ? ".next" : process.env.NEXT_DIST_DIR ?? ".next" } });
  const seconds = Math.round((Date.now() - start) / 1000);
  const ok = r.status === 0;
  results.push({ name: step.name, status: ok ? "PASS" : "FAIL", seconds });
  if (!ok && step.required) failed = true;
}
console.log("\nRelease gate summary");
for (const r of results) console.log(`${r.status.padEnd(8)} ${r.name}${r.seconds ? ` (${r.seconds}s)` : ""}`);
if (failed) {
  console.log("\nGATE FAILED: fix the failing check above before releasing.");
  process.exit(1);
}
console.log(`\nGATE PASSED${skipE2e || skipBuild ? " (partial run; skipped steps are not evidence)" : ""}.`);

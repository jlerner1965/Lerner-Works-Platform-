import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

/**
 * Smoke tests against a deployed environment (docs/LAUNCH-CHECKLIST.md section 6). No local
 * server, no database reset: everything goes through the deployed application and the
 * providers' APIs, driven by SMOKE_* variables. Run: `pnpm smoke -- --project=smoke`.
 */
const fallbackChromium = ["/opt/pw-browsers/chromium/chrome-linux/chrome", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ?? fallbackChromium;

export default defineConfig({
  testDir: "tests/smoke",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/smoke",
  use: {
    baseURL: process.env.SMOKE_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: "smoke", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});

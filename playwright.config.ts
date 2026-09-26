import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env", quiet: true });

// Prefer the browser Playwright expects; fall back to a preinstalled Chromium build when the
// exact revision is absent (e.g. PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD environments).
const fallbackChromium = ["/opt/pw-browsers/chromium/chrome-linux/chrome", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ?? fallbackChromium;

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: "pnpm exec tsx scripts/e2e-server.ts",
    url: `${baseURL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});

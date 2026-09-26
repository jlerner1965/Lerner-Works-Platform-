import fs from "node:fs";
import postgres from "postgres";
import { applyTestEnv, TEST_PASSWORD } from "./env";

/** Resets the isolated test database, migrates it and seeds the demonstration fixtures once. */
export default async function globalSetup(): Promise<void> {
  const { adminUrl } = applyTestEnv();
  // Storage must be cleared before seeding: the seed writes derivatives the fixtures reference.
  fs.rmSync(".data/test-storage", { recursive: true, force: true });
  fs.rmSync(".data/test-mail", { recursive: true, force: true });
  const { resetDatabase } = await import("../../scripts/lib/db-admin");
  await resetDatabase(adminUrl);
  const { seedDemo } = await import("../../src/server/demo/seed");
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {}, transform: postgres.camel });
  try {
    const result = await seedDemo(admin, { passwordFor: () => TEST_PASSWORD });
    fs.mkdirSync(".data", { recursive: true });
    fs.writeFileSync(".data/test-seed.json", JSON.stringify(result, null, 2));
  } finally {
    await admin.end();
  }
  const { endPool } = await import("../../src/server/data/db");
  await endPool();
}

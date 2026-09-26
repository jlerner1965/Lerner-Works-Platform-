import postgres, { type Sql } from "postgres";
import { getConfig } from "@/server/config";

/**
 * Elevated database access that bypasses row-level security. Import this module only from
 * narrowly scoped server-only modules (notification worker processing, retention jobs,
 * seed/import tooling). Never from request handlers that act on behalf of a user.
 */

declare global {
  var __lwAdminPool: Sql | undefined;
}

export function elevatedDb(): Sql {
  if (!globalThis.__lwAdminPool) {
    const cfg = getConfig();
    if (!cfg.DATABASE_ADMIN_URL) {
      throw new Error("DATABASE_ADMIN_URL is not configured; elevated operations are unavailable.");
    }
    globalThis.__lwAdminPool = postgres(cfg.DATABASE_ADMIN_URL, {
      max: 4,
      idle_timeout: 30,
      prepare: false,
      onnotice: () => {},
      transform: postgres.camel,
    });
  }
  return globalThis.__lwAdminPool;
}

import postgres, { type Sql, type TransactionSql } from "postgres";
import { getConfig } from "@/server/config";

/**
 * Request-scoped database access. The pool connects as a non-privileged login role that has
 * no table privileges of its own; every operation runs inside a transaction that switches
 * to `anon` or `authenticated` and sets the JWT claims Supabase's policies expect. Row-level
 * security therefore applies to every ordinary query with the real user's identity.
 */

declare global {
  var __lwAppPool: Sql | undefined;
}

function pool(): Sql {
  if (!globalThis.__lwAppPool) {
    const cfg = getConfig();
    globalThis.__lwAppPool = postgres(cfg.DATABASE_URL, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      prepare: false,
      onnotice: () => {},
      transform: postgres.camel,
    });
  }
  return globalThis.__lwAppPool;
}

export type Db = TransactionSql<Record<string, never>>;

export class DbAccessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DbAccessError";
  }
}

/** Runs `fn` as the anonymous public visitor role. */
export async function withAnon<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return pool().begin(async (tx) => {
    await tx`select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true)`;
    return fn(tx as unknown as Db);
  }) as Promise<T>;
}

/**
 * Runs `fn` as the application's own connecting role, without switching to anon or
 * authenticated. That role owns no table privileges; it may only execute the session
 * functions in the private schema. Use this for session bookkeeping only.
 */
export async function withApp<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return pool().begin(async (tx) => fn(tx as unknown as Db)) as Promise<T>;
}

/** Runs `fn` as the authenticated user identified by `userId`. */
export async function withUser<T>(userId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new DbAccessError("invalid user id", "invalid_user");
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  return pool().begin(async (tx) => {
    await tx`select set_config('role', 'authenticated', true), set_config('request.jwt.claims', ${claims}, true)`;
    return fn(tx as unknown as Db);
  }) as Promise<T>;
}

/** Maps PostgreSQL errors raised by our functions to stable application error codes. */
export function describeDbError(err: unknown): { code: string; message: string } {
  const e = err as { code?: string; message?: string; severity?: string } | undefined;
  const message = (e?.message ?? "Database error").replace(/\s+$/, "");
  switch (e?.code) {
    case "42501":
      return { code: "forbidden", message };
    case "P0002":
      return { code: "not_found", message };
    case "P0003":
      return { code: "rate_limited", message };
    case "22023":
      return { code: "invalid", message };
    case "23505":
      return { code: "conflict", message };
    case "P0001":
      return { code: "rejected", message };
    default:
      return { code: "error", message };
  }
}

export async function endPool(): Promise<void> {
  await globalThis.__lwAppPool?.end({ timeout: 5 });
  globalThis.__lwAppPool = undefined;
}

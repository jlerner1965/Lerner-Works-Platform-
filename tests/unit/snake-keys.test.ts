import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { snakeCaseKeys } from "@/lib/snake-keys";
import { csvSpecs, importableKinds } from "@/server/import/csv-spec";
import { siteSheetKeys } from "@/server/import/onboarding";

/**
 * The database client (transform: postgres.camel) camel-cases the keys of json objects on
 * read, so stored column mappings and settings come back as "externalId", "primaryColor".
 * Every key the imports store must survive the round trip exactly.
 */
describe("snake_case keys after the database client's camel transform", () => {
  const toCamel = postgres.toCamel as (s: string) => string;

  it("restores every CSV column key and every settings key", () => {
    const keys = new Set<string>(siteSheetKeys.map((k) => k.key));
    for (const kind of importableKinds) for (const c of csvSpecs[kind]) keys.add(c.key);
    expect(keys.size).toBeGreaterThan(40);
    const stored: Record<string, string> = {};
    for (const k of keys) stored[k] = `value of ${k}`;
    const asRead: Record<string, string> = {};
    for (const [k, v] of Object.entries(stored)) asRead[toCamel(k)] = v;
    expect(Object.keys(asRead).some((k) => /[A-Z]/.test(k))).toBe(true);
    expect(snakeCaseKeys(asRead)).toEqual(stored);
  });

  it("leaves keys without capitals alone and tolerates nothing stored", () => {
    expect(snakeCaseKeys({ title: "x", hours_mon: "y" })).toEqual({ title: "x", hours_mon: "y" });
    expect(snakeCaseKeys(undefined)).toEqual({});
    expect(snakeCaseKeys(null)).toEqual({});
  });
});

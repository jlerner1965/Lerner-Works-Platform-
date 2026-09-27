import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Client privileges in the migrations (decision D-028). A Supabase project grants the client
 * roles every privilege on new tables and execute on new functions in public by default, so
 * every table and function the migrations create must state its client grants explicitly:
 * a revoke naming anon and authenticated, then the grants meant. The hardening migration of
 * 2026-09-27 re-issued every function grant made before it; this test keeps that list equal
 * to the grants in the earlier migrations, and holds later migrations to the rule.
 */
const dir = path.resolve("supabase/migrations");
const POLICIES = "20260925000400_policies.sql";
const HARDENING = "20260927000600_hosted_grants_hardening.sql";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const revokesBoth = (statement: string) => /\banon\b/.test(statement) && /\bauthenticated\b/.test(statement);

describe("client privileges in the migrations", () => {
  it("every table created after the policies migration has an explicit revoke from anon and authenticated", () => {
    const later = files.filter((f) => f > POLICIES);
    const tables = later.flatMap((f) => [...read(f).matchAll(/create table (?:if not exists )?public\.([a-z_]+)/g)].map((m) => ({ file: f, table: m[1]! })));
    expect(tables.map((t) => t.table)).toEqual(["app_sessions", "upload_sessions", "site_sources", "organization_secrets"]);
    const all = files.map(read).join("\n");
    for (const t of tables) {
      const statements = [...all.matchAll(new RegExp(`revoke all on (?:table )?public\\.${t.table} from [^;]+;`, "g"))].map((m) => m[0]);
      expect(statements.some(revokesBoth), `${t.table} (${t.file}) needs "revoke all on table public.${t.table} from public, anon, authenticated"`).toBe(true);
    }
  });

  it("the hardening migration re-issues every function grant the earlier migrations made, minus signatures dropped since", () => {
    const before = files.filter((f) => f < HARDENING);
    const grants = new Set<string>();
    const dropped = new Set<string>();
    for (const f of before) {
      const text = read(f);
      for (const m of text.matchAll(/grant execute on function (public\.[a-z_]+\([^)]*\)) to [^;]+;/g)) grants.add(squash(m[0]));
      for (const m of text.matchAll(/drop function if exists (public\.[a-z_]+\([^)]*\))/g)) dropped.add(squash(m[1]!));
    }
    const expected = [...grants].filter((g) => !dropped.has(squash(g.match(/function (public\.[a-z_]+\([^)]*\))/)![1]!)));
    expect(expected.length).toBeGreaterThan(30);
    const hardening = squash(read(HARDENING));
    expect(hardening).toContain("revoke execute on all functions in schema public from public, anon, authenticated;");
    for (const g of expected) expect(hardening, `missing in the hardening migration: ${g}`).toContain(g);
    // Nothing is granted to the client roles that no earlier migration granted (the purge functions stay with the elevated role).
    const reissued = [...hardening.matchAll(/grant execute on function (public\.[a-z_]+\([^)]*\)) to [^;]+;/g)].map((m) => squash(m[0]));
    for (const g of reissued) expect(expected, `granted in the hardening migration without an earlier grant: ${g}`).toContain(g);
    expect(hardening).not.toMatch(/grant execute on function public\.purge_/);
  });

  it("every function created after the hardening migration revokes execute from anon and authenticated in its own file", () => {
    const later = files.filter((f) => f > HARDENING);
    for (const f of later) {
      const text = read(f);
      const created = [...text.matchAll(/create (?:or replace )?function (public\.[a-z_]+)\(/g)].map((m) => m[1]!);
      for (const fn of new Set(created)) {
        const revokes = [...text.matchAll(new RegExp(`revoke (?:all|execute) on function ${fn.replace(".", "\\.")}\\([^)]*\\) from [^;]+;`, "g"))].map((m) => m[0]);
        expect(revokes.some(revokesBoth), `${f}: ${fn} needs "revoke all on function ${fn}(...) from public, anon, authenticated" before its grants`).toBe(true);
      }
    }
  });
});

import { createHash, randomBytes } from "node:crypto";
import { getConfig } from "@/server/config";
import { withAnon, withApp, describeDbError } from "@/server/data/db";
import { GoTrueClient } from "@/server/auth/gotrue";
import type { AuthProvider, SessionCookie, SessionUser, SignInResult } from "@/server/auth/provider";

/**
 * Hosted authentication: Supabase Auth (GoTrue) owns accounts and passwords; the platform
 * verifies credentials against it once and then issues its own opaque session, stored as a
 * SHA-256 hash in public.app_sessions and reachable only through the private session
 * functions (executable by the application's connecting role alone). Per request this costs
 * one indexed query and needs no token refresh in the browser.
 */

const COOKIE_NAME = "lw_session";

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashSessionToken(token) };
}

export function gotrueFromConfig(): GoTrueClient {
  const cfg = getConfig();
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required for the Supabase auth provider.");
  return new GoTrueClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, cfg.SUPABASE_SERVICE_ROLE_KEY);
}

/** Issues a platform session for an already-verified user id. */
export async function createAppSession(userId: string, userAgent: string | null = null): Promise<SessionCookie> {
  const cfg = getConfig();
  const { token, hash } = newSessionToken();
  const ttl = `${cfg.SESSION_DAYS} days`;
  const rows = await withApp(
    (db) => db<{ sessionId: string; expiresAt: Date }[]>`
      select session_id, expires_at from private.create_app_session(${userId}, ${hash}, ${ttl}::interval, ${userAgent})`,
  );
  const row = rows[0];
  if (!row) throw new Error("session could not be created");
  return { name: COOKIE_NAME, value: token, expires: row.expiresAt };
}

export async function resolveAppSession(cookieValue: string | undefined): Promise<SessionUser | null> {
  if (!cookieValue || !/^[0-9a-f]{64}$/.test(cookieValue)) return null;
  const rows = await withApp(
    (db) => db<{ userId: string; email: string | null; expiresAt: Date }[]>`
      select user_id, email, expires_at from private.resolve_app_session(${hashSessionToken(cookieValue)})`,
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.userId, email: (row.email ?? "").toLowerCase(), expiresAt: row.expiresAt };
}

export async function deleteAppSession(cookieValue: string | undefined): Promise<void> {
  if (!cookieValue || !/^[0-9a-f]{64}$/.test(cookieValue)) return;
  await withApp((db) => db`select private.delete_app_session(${hashSessionToken(cookieValue)})`);
}

export function createSupabaseAuthProvider(gotrue: GoTrueClient = gotrueFromConfig()): AuthProvider {
  return {
    name: "supabase",
    cookieName: COOKIE_NAME,

    async signInWithPassword(email, password): Promise<SignInResult> {
      const outcome = await gotrue.signInWithPassword(email.trim().toLowerCase(), password);
      if (!outcome.ok) return { ok: false, reason: outcome.reason };
      const cookie = await createAppSession(outcome.session.user.id);
      return { ok: true, cookie, user: { id: outcome.session.user.id, email: outcome.session.user.email || email.trim().toLowerCase() } };
    },

    resolveSession: resolveAppSession,
    signOut: deleteAppSession,

    /**
     * Creates the invited account through the administrative API. The invitation token was
     * delivered to the invitee's address, which is the same proof of email ownership the
     * local provider relies on; the account is created confirmed and the caller then accepts
     * the invitation as that user.
     */
    async registerInvitedUser(invitationToken, password) {
      if (!/^[0-9a-f]{64}$/.test(invitationToken)) return { ok: false, reason: "rejected", message: "This invitation link is not valid." };
      let preview: { email: string; state: string } | undefined;
      try {
        preview = (await withAnon((db) => db<{ email: string; state: string }[]>`select email, state from public.get_invitation_preview(${invitationToken})`))[0];
      } catch (err) {
        return { ok: false, reason: "rejected", message: describeDbError(err).message };
      }
      if (!preview) return { ok: false, reason: "rejected", message: "This invitation link is not valid." };
      if (preview.state !== "valid") return { ok: false, reason: "rejected", message: `This invitation is ${preview.state}. Ask the organization owner for a new one.` };
      const created = await gotrue.adminCreateUser(preview.email, password);
      if (!created.ok) {
        if (created.reason === "exists") return { ok: false, reason: "rejected", message: "An account with this email already exists. Sign in with it and open the invitation link again." };
        if (created.reason === "unavailable") return { ok: false, reason: "unavailable" };
        return { ok: false, reason: "rejected", message: `The identity provider rejected the account: ${created.message}` };
      }
      const cookie = await createAppSession(created.user.id);
      return { ok: true, cookie, user: created.user };
    },
  };
}

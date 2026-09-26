import { withAnon, describeDbError } from "@/server/data/db";
import { getConfig } from "@/server/config";
import type { AuthProvider, SessionUser, SignInResult } from "@/server/auth/provider";

/**
 * Development-only authentication: bcrypt-verified passwords and database-backed opaque
 * sessions provided by the local auth shim (supabase/local/0000_auth_shim.sql). Refused
 * outside APP_ENV=local by getConfig(). Hosted deployments use Supabase Auth instead.
 */

const COOKIE_NAME = "lw_session";

export const localAuthProvider: AuthProvider = {
  name: "local",
  cookieName: COOKIE_NAME,

  async signInWithPassword(email, password): Promise<SignInResult> {
    getConfig();
    const rows = await withAnon(
      (db) => db<{ userId: string; sessionToken: string; expiresAt: Date }[]>`
        select user_id, session_token, expires_at from local_auth.sign_in(${email}, ${password})`,
    );
    const row = rows[0];
    if (!row) return { ok: false, reason: "invalid_credentials" };
    return {
      ok: true,
      cookie: { name: COOKIE_NAME, value: row.sessionToken, expires: row.expiresAt },
      user: { id: row.userId, email: email.toLowerCase() },
    };
  },

  async resolveSession(cookieValue): Promise<SessionUser | null> {
    if (!cookieValue || cookieValue.length !== 64) return null;
    const rows = await withAnon(
      (db) => db<{ userId: string; email: string; expiresAt: Date }[]>`
        select user_id, email, expires_at from local_auth.resolve_session(${cookieValue})`,
    );
    const row = rows[0];
    if (!row) return null;
    return { id: row.userId, email: row.email, expiresAt: row.expiresAt };
  },

  async signOut(cookieValue): Promise<void> {
    if (!cookieValue) return;
    await withAnon((db) => db`select local_auth.sign_out(${cookieValue})`);
  },

  async registerInvitedUser(invitationToken, password) {
    try {
      const rows = await withAnon(
        (db) => db<{ userId: string; sessionToken: string; expiresAt: Date }[]>`
          select user_id, session_token, expires_at from local_auth.register_invited_user(${invitationToken}, ${password})`,
      );
      const row = rows[0];
      if (!row) return { ok: false, reason: "unavailable" };
      return {
        ok: true,
        cookie: { name: COOKIE_NAME, value: row.sessionToken, expires: row.expiresAt },
        user: { id: row.userId, email: "" },
      };
    } catch (err) {
      const d = describeDbError(err);
      return { ok: false, reason: "rejected", message: d.message };
    }
  },
};

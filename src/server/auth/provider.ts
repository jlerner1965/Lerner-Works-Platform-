import { getConfig } from "@/server/config";
import { localAuthProvider } from "@/server/auth/local-provider";
import { createSupabaseAuthProvider } from "@/server/auth/supabase-provider";

export interface SessionUser {
  id: string;
  email: string;
  expiresAt: Date;
}

export interface SessionCookie {
  name: string;
  value: string;
  expires: Date;
}

export type SignInResult =
  | { ok: true; cookie: SessionCookie; user: { id: string; email: string } }
  | { ok: false; reason: "invalid_credentials" | "unavailable" };

export interface AuthProvider {
  readonly name: "local" | "supabase";
  /** Verifies a password and returns a cookie to set on success. */
  signInWithPassword(email: string, password: string): Promise<SignInResult>;
  /** Resolves the current session from the request cookie value, or null. */
  resolveSession(cookieValue: string | undefined): Promise<SessionUser | null>;
  /** Revokes the session identified by the cookie value. */
  signOut(cookieValue: string | undefined): Promise<void>;
  /** Creates the invited account with a password and returns a session cookie. */
  registerInvitedUser?(invitationToken: string, password: string): Promise<SignInResult | { ok: false; reason: "rejected"; message: string }>;
  readonly cookieName: string;
}

declare global {
  var __lwAuthProvider: AuthProvider | undefined;
}

export function getAuthProvider(): AuthProvider {
  if (!globalThis.__lwAuthProvider) {
    const cfg = getConfig();
    globalThis.__lwAuthProvider = cfg.AUTH_PROVIDER === "local" ? localAuthProvider : createSupabaseAuthProvider();
  }
  return globalThis.__lwAuthProvider;
}

import { getConfig } from "@/server/config";
import { localAuthProvider } from "@/server/auth/local-provider";

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
  /** Creates the invited account (local provider only) and returns a session cookie. */
  registerInvitedUser?(invitationToken: string, password: string): Promise<SignInResult | { ok: false; reason: "rejected"; message: string }>;
  readonly cookieName: string;
}

export function getAuthProvider(): AuthProvider {
  const cfg = getConfig();
  if (cfg.AUTH_PROVIDER === "local") return localAuthProvider;
  // The hosted Supabase Auth adapter is wired in src/server/auth/supabase-provider.ts once a
  // project is configured; until then the configuration check in getConfig() rejects it.
  throw new Error("Supabase auth provider is not configured in this build. See docs/OPERATIONS.md.");
}

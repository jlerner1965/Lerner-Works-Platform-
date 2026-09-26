"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getConfig } from "@/server/config";
import { getSessionUser } from "@/server/auth/session";
import { gotrueFromConfig, createAppSession } from "@/server/auth/supabase-provider";

export interface RecoveryState {
  message?: string;
  error?: string;
}

const PKCE_COOKIE = "lw_pkce";
const NEUTRAL = "If an account exists for that address, an email with a link to choose a new password is on its way. The link expires after a short time.";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Starts password recovery through Supabase Auth with the PKCE flow: the verifier stays in an
 * httpOnly cookie, the provider emails a link back to /auth/recovery with a one-time code.
 * The response never reveals whether the address is registered.
 */
export async function requestPasswordRecoveryAction(_prev: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const cfg = getConfig();
  if (cfg.AUTH_PROVIDER !== "supabase") {
    return { error: "Password recovery is provided by the hosted identity provider. In local development, run `pnpm seed:demo` to reset the demonstration accounts." };
  }
  const email = z.string().trim().pipe(z.email()).safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const jar = await cookies();
  jar.set(PKCE_COOKIE, verifier, { httpOnly: true, sameSite: "lax", secure: cfg.APP_URL.startsWith("https://"), path: "/auth", maxAge: 60 * 60 });
  const result = await gotrueFromConfig().requestPasswordRecovery(email.data.toLowerCase(), `${cfg.APP_URL}/auth/recovery`, challenge);
  if (!result.ok && /network error|responded 5\d\d/.test(result.message ?? "")) {
    return { error: "The identity provider could not be reached. Try again in a few minutes." };
  }
  return { message: NEUTRAL };
}

/**
 * Completes recovery and signs in. Two link formats are accepted: a token hash from the
 * provider's email template (`?token_hash=…&type=recovery`, usable from any browser) or a
 * PKCE code (`?code=…`) exchanged with the verifier cookie set when the request was made.
 */
export async function completePasswordRecoveryAction(_prev: RecoveryState, formData: FormData): Promise<RecoveryState> {
  const cfg = getConfig();
  if (cfg.AUTH_PROVIDER !== "supabase") return { error: "Password recovery is not available in this environment." };
  const code = String(formData.get("code") ?? "").trim();
  const tokenHash = String(formData.get("tokenHash") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if ((!code && !tokenHash) || code.length > 512 || tokenHash.length > 512) return { error: "The recovery link is incomplete. Request a new one." };
  if (password.length < 12) return { error: "Use at least 12 characters." };
  if (password !== confirm) return { error: "The passwords do not match." };
  if (await getSessionUser()) return { error: "You are already signed in. Sign out before using a recovery link." };
  const jar = await cookies();
  const gotrue = gotrueFromConfig();
  let exchanged;
  if (tokenHash) {
    exchanged = await gotrue.verifyRecoveryTokenHash(tokenHash);
  } else {
    const verifier = jar.get(PKCE_COOKIE)?.value;
    if (!verifier) return { error: "This browser did not start the recovery, or the request expired. Request a new link from the same browser." };
    exchanged = await gotrue.exchangeCodeForSession(code, verifier);
  }
  if (!exchanged.ok) {
    return { error: exchanged.reason === "invalid_code" ? "The recovery link is invalid or has expired. Request a new one." : "The identity provider could not be reached. Try again in a few minutes." };
  }
  const updated = await gotrue.updatePassword(exchanged.session.accessToken, password);
  if (!updated.ok) return { error: `The password was not accepted: ${updated.message ?? "unknown reason"}` };
  jar.delete(PKCE_COOKIE);
  const cookie = await createAppSession(exchanged.session.user.id);
  jar.set(cookie.name, cookie.value, { httpOnly: true, sameSite: "lax", secure: cfg.APP_URL.startsWith("https://"), path: "/", expires: cookie.expires });
  redirect("/app?password-reset=1");
}

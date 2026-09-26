import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthProvider, type SessionUser } from "@/server/auth/provider";

/** Current signed-in user for this request, memoized across server components. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const provider = getAuthProvider();
  const jar = await cookies();
  const value = jar.get(provider.cookieName)?.value;
  if (!value) return null;
  try {
    return await provider.resolveSession(value);
  } catch {
    return null;
  }
});

/** Redirects to sign-in when there is no session. `next` must be a same-site path. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const target = nextPath && /^\/[^/\\]/.test(nextPath) ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in";
    redirect(target);
  }
  return user;
}

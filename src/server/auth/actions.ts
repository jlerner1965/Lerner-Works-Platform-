"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthProvider } from "@/server/auth/provider";
import { getConfig } from "@/server/config";

export interface SignInState {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  values?: { email: string };
}

const signInSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

function safeNext(next: string | undefined): string {
  if (next && /^\/(?!\/)[^\s]*$/.test(next)) return next;
  return "/app";
}

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  const emailValue = String(formData.get("email") ?? "");
  if (!parsed.success) {
    const fieldErrors: SignInState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "email" && !fieldErrors.email) fieldErrors.email = issue.message;
      if (key === "password" && !fieldErrors.password) fieldErrors.password = issue.message;
    }
    return { fieldErrors, values: { email: emailValue } };
  }
  const provider = getAuthProvider();
  let result;
  try {
    result = await provider.signInWithPassword(parsed.data.email, parsed.data.password);
  } catch {
    return { error: "Sign-in is temporarily unavailable. The database could not be reached.", values: { email: emailValue } };
  }
  if (!result.ok) {
    return {
      error: result.reason === "invalid_credentials" ? "The email or password is incorrect." : "Sign-in is temporarily unavailable.",
      values: { email: emailValue },
    };
  }
  const jar = await cookies();
  jar.set(result.cookie.name, result.cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: getConfig().APP_URL.startsWith("https://"),
    path: "/",
    expires: result.cookie.expires,
  });
  redirect(safeNext(parsed.data.next));
}

export async function signOutAction(): Promise<void> {
  const provider = getAuthProvider();
  const jar = await cookies();
  const value = jar.get(provider.cookieName)?.value;
  try {
    await provider.signOut(value);
  } finally {
    jar.delete(provider.cookieName);
  }
  redirect("/sign-in?signed-out=1");
}

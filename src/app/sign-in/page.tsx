import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getConfig } from "@/server/config";
import { SignInForm } from "@/components/admin/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; "signed-out"?: string }> }) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user) redirect("/app");
  const cfg = getConfig();
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Lerner Works Platform</p>
          <h1 className="mt-1 text-2xl font-semibold">Sign in</h1>
          {params["signed-out"] ? <p className="mt-2 text-sm text-success">You have been signed out.</p> : null}
        </div>
        <SignInForm next={params.next} recoveryHref={cfg.AUTH_PROVIDER === "supabase" ? "/forgot-password" : undefined} />
        {cfg.isLocal ? (
          <p className="mt-6 text-xs text-ink-subtle">
            Local development accounts are listed in <code>docs/local-accounts.md</code> after running <code>pnpm seed:demo</code>.
          </p>
        ) : null}
      </div>
    </main>
  );
}

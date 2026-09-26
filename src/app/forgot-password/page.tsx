import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getConfig } from "@/server/config";
import { ForgotPasswordForm } from "@/components/admin/recovery-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  if (await getSessionUser()) redirect("/app");
  const cfg = getConfig();
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Lerner Works Platform</p>
          <h1 className="mt-1 text-2xl font-semibold">Forgot your password?</h1>
        </div>
        {cfg.AUTH_PROVIDER === "supabase" ? (
          <ForgotPasswordForm />
        ) : (
          <p className="rounded border border-line bg-surface p-6 text-sm">Password recovery is provided by the hosted identity provider. In local development, run <code>pnpm seed:demo</code> to reset the demonstration accounts listed in <code>docs/local-accounts.md</code>.</p>
        )}
        <p className="mt-6 text-sm"><Link href="/sign-in" className="text-action underline">Back to sign in</Link></p>
      </div>
    </main>
  );
}

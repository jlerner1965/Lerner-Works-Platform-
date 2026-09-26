import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/server/auth/session";
import { withAnon } from "@/server/data/db";
import { getConfig } from "@/server/config";
import { InviteAcceptForm, InviteRegisterForm } from "@/components/admin/invite-forms";

export const metadata: Metadata = { title: "Invitation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[0-9a-f]{64}$/.test(token);
  const preview = valid ? (await withAnon((db) => db<{ organizationName: string; email: string; organizationRole: string; expiresAt: Date; state: string }[]>`select * from public.get_invitation_preview(${token})`))[0] : undefined;
  const user = await getSessionUser();
  const cfg = getConfig();
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Lerner Works Platform</p>
      <h1 className="mt-1 text-2xl font-semibold">Invitation</h1>
      {!preview ? (
        <p className="mt-4 text-ink-muted">This invitation link is not valid. Ask the organization owner for a new one.</p>
      ) : preview.state !== "valid" ? (
        <p className="mt-4 text-ink-muted">This invitation has {preview.state === "accepted" ? "already been used" : preview.state === "revoked" ? "been revoked" : "expired"}. Ask the organization owner for a new one.</p>
      ) : (
        <div className="mt-4 space-y-4 rounded border border-line bg-surface p-5">
          <p>You have been invited to join <strong>{preview.organizationName}</strong> as <strong>{preview.organizationRole}</strong>. The invitation was issued to <strong>{preview.email}</strong> and expires {preview.expiresAt.toUTCString()}.</p>
          {user ? (
            user.email.toLowerCase() === preview.email ? (
              <InviteAcceptForm token={token} />
            ) : (
              <p className="text-sm text-danger">You are signed in as {user.email}, but this invitation is for {preview.email}. Sign out and use the invited account.</p>
            )
          ) : cfg.AUTH_PROVIDER === "local" ? (
            <>
              <InviteRegisterForm token={token} email={preview.email} />
              <p className="text-xs text-ink-subtle">Already have an account with this email? <Link href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`} className="text-action underline">Sign in</Link> and come back to this link.</p>
            </>
          ) : (
            <p className="text-sm">Sign in with the invited account to accept. <Link href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`} className="text-action underline">Sign in</Link></p>
          )}
        </div>
      )}
    </main>
  );
}

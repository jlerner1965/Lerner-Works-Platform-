"use client";

import { useActionState, useId } from "react";
import { setMemberRolesAction, removeMemberAction, createInvitationAction, revokeInvitationAction, type AccessState } from "@/server/actions/access";
import { Alert, Button, inputClass, selectClass, formatDateTime } from "@/components/admin/ui";

export function MemberRow({ siteId, member, otherSites, isSelf, isLastOwner }: { siteId: string; member: { userId: string; email: string; organizationRole: string; siteRole: string; joinedAt: string }; otherSites: string[]; isSelf: boolean; isLastOwner: boolean }) {
  const [state, action, pending] = useActionState<AccessState, FormData>(setMemberRolesAction, {});
  const [removeState, removeAction, removing] = useActionState<AccessState, FormData>(removeMemberAction, {});
  const id = useId();
  return (
    <tr className="border-b border-line align-top">
      <td className="py-2 pr-3">
        <p className="font-medium">{member.email}{isSelf ? <span className="ml-1 text-xs text-ink-subtle">(you)</span> : null}</p>
        <p className="text-xs text-ink-subtle">joined {formatDateTime(member.joinedAt)}</p>
        {state.message ? <p className="text-xs text-success">{state.message}</p> : null}
        {state.error ? <p className="text-xs text-danger" role="alert">{state.error}</p> : null}
        {removeState.error ? <p className="text-xs text-danger" role="alert">{removeState.error}</p> : null}
        {removeState.message ? <p className="text-xs text-success">{removeState.message}</p> : null}
      </td>
      <td className="py-2 pr-3" colSpan={2}>
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="siteId" value={siteId} />
          <input type="hidden" name="userId" value={member.userId} />
          <label className="flex flex-col text-xs">Organization
            <select name="organizationRole" defaultValue={member.organizationRole} className={selectClass} disabled={isLastOwner} aria-describedby={isLastOwner ? `${id}-last` : undefined}>
              <option value="owner">owner</option>
              <option value="member">member</option>
            </select>
          </label>
          <label className="flex flex-col text-xs">This site
            <select name="siteRole" defaultValue={member.siteRole} className={selectClass}>
              <option value="none">none</option>
              <option value="publisher">publisher</option>
              <option value="editor">editor</option>
              <option value="reviewer">reviewer</option>
            </select>
          </label>
          <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          {isLastOwner ? <p id={`${id}-last`} className="w-full text-xs text-ink-subtle">Last owner: cannot be demoted or removed.</p> : null}
        </form>
      </td>
      <td className="py-2 pr-3 text-xs text-ink-muted">{otherSites.length ? otherSites.join(", ") : "—"}</td>
      <td className="py-2">
        <form action={removeAction}>
          <input type="hidden" name="siteId" value={siteId} />
          <input type="hidden" name="userId" value={member.userId} />
          <Button type="submit" variant="danger" disabled={removing || isLastOwner}>{removing ? "Removing…" : "Remove"}</Button>
        </form>
      </td>
    </tr>
  );
}

export function InviteForm({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [state, action, pending] = useActionState<AccessState, FormData>(createInvitationAction, {});
  const id = useId();
  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="siteId" value={siteId} />
      {state.message ? (
        <Alert tone="success">
          <p>{state.message}</p>
          {state.inviteLink ? <p className="mt-1 break-all text-xs">Local mode only — invitation link: <a href={state.inviteLink} className="underline">{state.inviteLink}</a></p> : null}
        </Alert>
      ) : null}
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <label htmlFor={`${id}-email`} className="block font-medium">Email</label>
      <input id={`${id}-email`} name="email" type="email" required className={inputClass} />
      <label htmlFor={`${id}-org`} className="block font-medium">Organization role</label>
      <select id={`${id}-org`} name="organizationRole" defaultValue="member" className={selectClass}>
        <option value="member">member (needs a site role to do anything)</option>
        <option value="owner">owner (full access to every site)</option>
      </select>
      <label htmlFor={`${id}-site`} className="block font-medium">Role on {siteName}</label>
      <select id={`${id}-site`} name="siteRole" defaultValue="editor" className={selectClass}>
        <option value="none">none</option>
        <option value="editor">editor</option>
        <option value="reviewer">reviewer</option>
        <option value="publisher">publisher</option>
      </select>
      <Button type="submit" disabled={pending}>{pending ? "Inviting…" : "Send invitation"}</Button>
      <p className="text-xs text-ink-subtle">The invitation binds this email address and organization, expires in 7 days and can be used once. No password is generated or sent.</p>
    </form>
  );
}

export function RevokeInvitationForm({ siteId, invitationId }: { siteId: string; invitationId: string }) {
  const [state, action, pending] = useActionState<AccessState, FormData>(revokeInvitationAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      <Button type="submit" variant="ghost" disabled={pending}>{pending ? "…" : "Revoke"}</Button>
    </form>
  );
}

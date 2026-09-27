import Link from "next/link";
import { withUser } from "@/server/data/db";
import type { SiteContext } from "@/server/data/access";
import { previewOrigin } from "@/server/config";
import { Alert, Badge, Card, DescriptionList, LinkButton, PageHeader, formatDateTime } from "@/components/admin/ui";
import type { UploadedSnapshot } from "@/server/uploaded/archive";

/**
 * Overview of an uploaded site (B7): what is published, where to look at it, what arrived in
 * the inbox, the next upload, and the contact form snippet the site's HTML pastes in. Counts
 * and addresses are real; nothing here is invented.
 */
export async function UploadedOverview({ ctx, userId, notices }: { ctx: SiteContext; userId: string; notices: { created?: string; published?: string } }) {
  const { site, capabilities: cap } = ctx;
  const base = `/app/sites/${site.id}`;
  const data = await withUser(userId, async (db) => {
    const releases = site.activeReleaseId
      ? await db<Array<{ version: number; createdAt: Date; source: UploadedSnapshot["source"] | null; actor: string | null }>>`select r.version, r.created_at, r.snapshot->'source' as source, public.user_display(r.actor_id) as actor from public.releases r where r.id = ${site.activeReleaseId}`
      : [];
    const [counts] = await db<Array<{ newInquiries: number; releases: number; domains: number }>>`select
      (select count(*)::int from public.inquiries q where q.site_id = ${site.id} and q.status = 'new') as new_inquiries,
      (select count(*)::int from public.releases r where r.site_id = ${site.id}) as releases,
      (select count(*)::int from public.domains d where d.site_id = ${site.id}) as domains`;
    const canonical = await db<Array<{ normalizedHost: string }>>`select normalized_host from public.domains where site_id = ${site.id} and is_canonical and status = 'active' and verified_at is not null limit 1`;
    const pending = await db<Array<{ id: string; filename: string | null; createdAt: Date }>>`select id, filename, created_at from public.import_jobs where site_id = ${site.id} and package_type = 'uploaded_site' and state = 'dry_run' order by created_at desc limit 1`;
    return { release: releases[0] ?? null, counts: counts!, canonicalHost: canonical[0]?.normalizedHost ?? null, pending: pending[0] ?? null };
  });
  const preview = previewOrigin(site.key);
  const liveUrl = site.mode === "live" && data.canonicalHost ? `https://${data.canonicalHost}/` : null;
  const release = data.release;
  const snippet = `<form method="post" action="/_lw/inquiry">
  <input type="hidden" name="next" value="/thanks.html">
  <label>Name <input name="name" required></label>
  <label>Email <input name="email" type="email" required></label>
  <label>Phone (optional) <input name="phone"></label>
  <label>Message <textarea name="message" required></textarea></label>
  <label style="position:absolute;left:-9999px" aria-hidden="true">Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label>
  <button type="submit">Send</button>
</form>`;
  return (
    <>
      {notices.created ? <div className="mb-4"><Alert tone="success">Site created. Upload the site&apos;s ZIP to publish it; until then there is nothing to show.</Alert></div> : null}
      {notices.published ? <div className="mb-4"><Alert tone="success">Published release v{notices.published}. {preview ? <>Look at it at <a className="underline" href={`${preview}/`} target="_blank" rel="noreferrer">{preview}/</a>.</> : null}</Alert></div> : null}
      <PageHeader
        eyebrow={ctx.organization.name}
        title={site.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">Uploaded site</Badge>
            <Badge tone={site.mode === "demo" ? "warning" : "success"}>{site.mode === "demo" ? "Not live yet" : "Live"}</Badge>
            <Badge tone="info">Your access: {cap.isOwner ? "organization owner" : (cap.siteRole ?? "none")}</Badge>
          </span>
        }
        actions={cap.canPublish ? <LinkButton href={`${base}/upload`}>{release ? "Upload a new version" : "Upload the site"}</LinkButton> : null}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Published">
          {release ? (
            <>
              <p className="text-sm">Release v{release.version}, published {formatDateTime(release.createdAt, site.timeZone)}{release.actor ? ` by ${release.actor}` : ""}.</p>
              {release.source ? <p className="mt-1 text-sm text-ink-muted">{release.source.filename}: {release.source.files} file{release.source.files === 1 ? "" : "s"}, {(release.source.totalBytes / 1024 / 1024).toFixed(1)} MB.</p> : null}
              <p className="mt-2 text-sm"><Link href={`${base}/upload`} className="text-action underline">{data.counts.releases} release{data.counts.releases === 1 ? "" : "s"}, restore any of them</Link></p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Nothing published yet. {data.pending ? <Link href={`${base}/upload/${data.pending.id}`} className="text-action underline">An upload is checked and waiting to be published.</Link> : "Upload the site's ZIP to publish it."}</p>
          )}
          {release && data.pending ? <p className="mt-2 text-sm"><Link href={`${base}/upload/${data.pending.id}`} className="text-action underline">A newer upload is checked and waiting to be published.</Link></p> : null}
        </Card>
        <Card title="Where to look">
          <DescriptionList
            items={[
              { term: "Preview", value: preview ? (release ? <a className="text-action underline" href={`${preview}/`} target="_blank" rel="noreferrer">{preview}/</a> : <span className="text-ink-muted">{preview}/ once published</span>) : <span className="text-ink-muted">no preview hostname is configured on this deployment (PREVIEW_DOMAIN)</span> },
              { term: "Live", value: liveUrl ? <a className="text-action underline" href={liveUrl} target="_blank" rel="noreferrer">{liveUrl}</a> : data.canonicalHost ? <span className="text-ink-muted">{data.canonicalHost} is verified; go live in Settings → Publishing</span> : <span className="text-ink-muted">{data.counts.domains ? "a domain is registered but not yet verified and activated" : "no domain yet"} (<Link href={`${base}/settings#domains`} className="text-action underline">Settings → Domains</Link>)</span> },
            ]}
          />
        </Card>
        <Card title="Inbox">
          {cap.canViewInquiries ? (
            <p className="text-sm">
              {data.counts.newInquiries > 0 ? <Link href={`${base}/inquiries?status=new`} className="text-action underline">{data.counts.newInquiries} new inquir{data.counts.newInquiries === 1 ? "y" : "ies"}</Link> : <span className="text-ink-muted">No new inquiries.</span>}
            </p>
          ) : <p className="text-sm text-ink-muted">The inbox is for owners and publishers.</p>}
          <p className="mt-2 text-sm text-ink-muted">Recipients: {site.inquiryRecipients.length ? site.inquiryRecipients.join(", ") : <>none yet; set them in <Link href={`${base}/settings`} className="text-action underline">Settings</Link> so that messages are also emailed</>}.</p>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Contact form">
          <p className="text-sm text-ink-muted">Paste this form into any page of the site. It posts to the site&apos;s own address, the message lands in the inbox (and with the recipients), and the visitor is taken to the page named in <code>next</code> with <code>?sent=</code> and the receipt code. Keep the hidden &quot;website&quot; field: it catches robots.</p>
          <pre className="mt-3 overflow-x-auto rounded border border-line bg-surface-raised p-3 text-xs leading-5"><code>{snippet}</code></pre>
        </Card>
        <Card title="Site facts">
          <DescriptionList
            items={[
              { term: "Registry key", value: <code>{site.key}</code> },
              { term: "Time zone", value: site.timeZone },
              { term: "Contact email", value: site.contactEmail ?? "not set" },
              { term: "Pages", value: "whatever the ZIP holds: a page without its extension, a folder's index.html, and 404.html for a missing address" },
              { term: "Caching", value: "each file is served with its content hash as the ETag; a new upload is visible within a minute" },
            ]}
          />
        </Card>
      </div>
    </>
  );
}

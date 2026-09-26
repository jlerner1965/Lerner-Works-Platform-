import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { Badge, Card, DescriptionList, PageHeader, StatTile, formatDateTime } from "@/components/admin/ui";
import { presets } from "@/modules/presets";

export default async function SiteOverviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser(`/app/sites/${siteId}`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx) notFound();
  const { site, capabilities: cap } = ctx;

  const stats = await withUser(user.id, async (db) => {
    const [row] = await db<
      {
        items: number;
        unpublished: number;
        waitingReviews: number;
        newInquiries: number;
        latestReleaseVersion: number | null;
        latestReleaseAt: Date | null;
        candidates: number;
      }[]
    >`
      with active as (select r.snapshot from public.releases r where r.id = ${site.activeReleaseId})
      select
        (select count(*)::int from public.content_items i where i.site_id = ${site.id} and i.archived_at is null) as items,
        (select count(*)::int from public.content_items i join public.content_revisions r on r.id = i.current_revision_id
           where i.site_id = ${site.id} and i.archived_at is null
             and coalesce((select a.snapshot #>> array['items', i.id::text, 'revisionId'] from active a), '') <> r.id::text) as unpublished,
        (select count(*)::int from public.content_items i join public.content_revisions r on r.id = i.current_revision_id
           where i.site_id = ${site.id} and i.archived_at is null
             and (select rv.state from public.reviews rv where rv.revision_id = r.id order by rv.created_at desc limit 1) in ('submitted', 'comment')) as waiting_reviews,
        (select count(*)::int from public.inquiries q where q.site_id = ${site.id} and q.status = 'new') as new_inquiries,
        (select r.version from public.releases r where r.id = ${site.activeReleaseId}) as latest_release_version,
        (select r.created_at from public.releases r where r.id = ${site.activeReleaseId}) as latest_release_at,
        (select count(*)::int from public.release_candidates c where c.site_id = ${site.id} and c.state in ('ready', 'blocked')) as candidates`;
    return row!;
  });

  const base = `/app/sites/${site.id}`;
  return (
    <>
      <PageHeader
        eyebrow={ctx.organization.name}
        title={site.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{presets[site.preset].label}</Badge>
            <Badge tone={site.mode === "demo" ? "warning" : "success"}>{site.mode === "demo" ? "Demonstration site" : "Live site"}</Badge>
            <Badge tone="info">Your access: {cap.isOwner ? "organization owner" : (cap.siteRole ?? "none")}</Badge>
          </span>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Unpublished changes" value={stats.unpublished} href={`${base}/content?status=unpublished`} hint="items whose working revision is not the published one" />
        <StatTile label="Waiting for review" value={stats.waitingReviews} href={cap.canReview || cap.canEdit ? `${base}/reviews` : undefined} />
        <StatTile label="New inquiries" value={cap.canViewInquiries ? stats.newInquiries : "—"} href={cap.canViewInquiries ? `${base}/inquiries?status=new` : undefined} hint={cap.canViewInquiries ? undefined : "not visible to your role"} />
        <StatTile label="Latest release" value={stats.latestReleaseVersion ? `v${stats.latestReleaseVersion}` : "none"} href={cap.canPublish ? `${base}/publishing` : undefined} hint={stats.latestReleaseAt ? formatDateTime(stats.latestReleaseAt, site.timeZone) : "not published yet"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Site facts">
          <DescriptionList
            items={[
              { term: "Registry key", value: <code>{site.key}</code> },
              { term: "Time zone", value: site.timeZone },
              { term: "Contact email", value: site.contactEmail ?? "not set" },
              { term: "Inquiry recipients", value: site.inquiryRecipients.length ? site.inquiryRecipients.join(", ") : "none configured (inquiries are stored but no notification recipients exist)" },
              { term: "Content items", value: stats.items },
              { term: "Open candidates", value: stats.candidates },
              { term: "Public route", value: site.mode === "demo" ? <a className="text-action underline" href={`/demo/${site.key}`} target="_blank" rel="noreferrer">/demo/{site.key}</a> : "requires an active verified domain" },
            ]}
          />
        </Card>
        <Card title="Setup checklist">
          <SetupChecklist siteId={site.id} facts={{ items: stats.items, release: stats.latestReleaseVersion, contactEmail: site.contactEmail, recipients: site.inquiryRecipients.length }} />
        </Card>
      </div>
    </>
  );
}

function SetupChecklist({ siteId, facts }: { siteId: string; facts: { items: number; release: number | null; contactEmail: string | null; recipients: number } }) {
  const base = `/app/sites/${siteId}`;
  const tasks: Array<{ done: boolean; label: string; href: string }> = [
    { done: facts.items > 0, label: "Create the first content items", href: `${base}/content` },
    { done: Boolean(facts.contactEmail), label: "Set default contact information", href: `${base}/settings` },
    { done: facts.recipients > 0, label: "Configure inquiry notification recipients", href: `${base}/settings` },
    { done: facts.release !== null, label: "Publish the first release", href: `${base}/publishing` },
  ];
  return (
    <ul className="space-y-2 text-sm">
      {tasks.map((t) => (
        <li key={t.label} className="flex items-start gap-2">
          <span aria-hidden="true" className={`mt-0.5 inline-block h-4 w-4 rounded-sm border ${t.done ? "border-success bg-success" : "border-line-strong"}`} />
          <span className="sr-only">{t.done ? "Done:" : "To do:"}</span>
          {t.done ? <span className="text-ink-muted line-through">{t.label}</span> : <a href={t.href} className="text-action underline">{t.label}</a>}
        </li>
      ))}
    </ul>
  );
}

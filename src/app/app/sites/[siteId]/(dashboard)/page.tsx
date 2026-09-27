import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getCurrentSiteConfig } from "@/server/data/sites";
import { previewCandidate, type CandidatePreview } from "@/server/publishing/candidates";
import { Alert, Badge, Button, Card, DescriptionList, LinkButton, PageHeader, formatDateTime } from "@/components/admin/ui";
import { presets } from "@/modules/presets";
import { kindRegistry, type ContentKind } from "@/modules/registry";
import type { SiteConfig } from "@/modules/site-config";
import { capabilitiesFor } from "@/themes/capabilities";
import { typographyPresets } from "@/themes/fonts";
import { loadDemoContentAction } from "@/server/actions/demo";
import { fixtureForSite } from "@/server/demo/load";
import { UploadedOverview } from "./uploaded-overview";

export const dynamic = "force-dynamic";

/**
 * Site overview (site-building programme B1): the three daily tasks (content, look, publish)
 * with their live state, a setup checklist of actual missing data, and the site's facts.
 * Counts are real; nothing here is invented.
 */
export default async function SiteOverviewPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ demo?: string; demoError?: string; created?: string; published?: string }> }) {
  const { siteId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx) notFound();
  const { site, capabilities: cap } = ctx;
  // An uploaded site (B7) has no content, look or publish tasks: its overview is the release, the addresses and the inbox.
  if (site.siteType === "uploaded") return <UploadedOverview ctx={ctx} userId={user.id} notices={{ created: sp.created, published: sp.published }} />;

  const data = await withUser(user.id, async (db) => {
    const [stats] = await db<{ items: number; unpublished: number; waitingReviews: number; newInquiries: number; latestReleaseVersion: number | null; latestReleaseAt: Date | null }[]>`
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
        (select r.created_at from public.releases r where r.id = ${site.activeReleaseId}) as latest_release_at`;
    const kindRows = await db<{ kind: ContentKind; n: number }[]>`select kind, count(*)::int as n from public.content_items where site_id = ${site.id} and archived_at is null group by kind`;
    const config = await getCurrentSiteConfig(db, site.id);
    const starterPages = await db<{ id: string; slug: string; payload: { sections?: Array<{ type: string; imageAssetId?: string | null; body?: unknown[] }> } }[]>`
      select i.id, r.slug, r.payload from public.content_items i join public.content_revisions r on r.id = i.current_revision_id
      where i.site_id = ${site.id} and i.kind = 'page' and r.slug in ('home', 'about') and i.archived_at is null`;
    const home = starterPages.find((p) => p.slug === "home");
    const about = starterPages.find((p) => p.slug === "about");
    const [domains] = await db<{ n: number }[]>`select count(*)::int as n from public.domains where site_id = ${site.id}`;
    let preview: CandidatePreview | null = null;
    if (cap.canPublish && config) {
      try {
        preview = await previewCandidate(db, site);
      } catch {
        preview = null;
      }
    }
    return { stats: stats!, counts: new Map(kindRows.map((r) => [r.kind, r.n])), config: config?.config ?? null, home: home ?? null, about: about ?? null, domains: domains?.n ?? 0, preview };
  });

  const base = `/app/sites/${site.id}`;
  const kinds = presets[site.preset].kinds as ContentKind[];
  const config = data.config;
  const composition = config ? capabilitiesFor(site.preset, config.design).label : null;
  const typography = config ? typographyPresets[config.branding.typography]?.label : null;
  const hero = data.home?.payload.sections?.[0];
  const heroHasImage = hero?.type === "image_hero" && Boolean(hero.imageAssetId);
  // A text slot is "written" once some rich text section on the page has a body; pages without text slots count as written.
  const textWritten = (sections: Array<{ type: string; body?: unknown[] }> | undefined) => !sections?.some((s) => s.type === "rich_text") || sections.some((s) => s.type === "rich_text" && Array.isArray(s.body) && s.body.length > 0);
  const homeIntroWritten = textWritten(data.home?.payload.sections);
  const aboutWritten = textWritten(data.about?.payload.sections);
  const preview = data.preview;
  const s = preview?.summary;
  const changes = s ? s.added.length + s.changed.length + s.removed.length + s.configFields.length + s.mediaAdded.length + (s.mediaChanged?.length ?? 0) + s.mediaRemoved.length + (s.navigationChanged ? 1 : 0) : 0;
  const blockers = preview?.validation.blockers.length ?? 0;
  const waitingApproval = preview ? preview.notes.filter((n) => n.note === "excluded_unapproved" || n.note === "unapproved_newer_draft").length : 0;
  const hasFixture = site.mode === "demo" && cap.isOwner && fixtureForSite(site.key, new Date()) !== null;
  const stats = data.stats;

  return (
    <>
      {sp.created ? <div className="mb-4"><Alert tone="success">Site created from the {presets[site.preset].label} preset. The checklist below lists what is still missing, with a link to each place.</Alert></div> : null}
      {sp.demo ? <div className="mb-4"><Alert tone="success">Demonstration content loaded: {sp.demo}.</Alert></div> : null}
      {sp.demoError ? <div className="mb-4"><Alert tone="danger">Demonstration content could not be loaded: {sp.demoError}</Alert></div> : null}
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
        actions={cap.canPublish ? <LinkButton href={`${base}/publishing`}>Publish</LinkButton> : null}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Content">
          <ul className="space-y-1 text-sm">
            {kinds.map((kind) => {
              const n = data.counts.get(kind) ?? 0;
              return (
                <li key={kind} className="flex items-center justify-between gap-2">
                  <Link href={`${base}/content?kind=${kind}`} className="text-action underline">{n} {n === 1 ? kindRegistry[kind].label.toLowerCase() : kindRegistry[kind].plural.toLowerCase()}</Link>
                  {cap.canEdit ? <Link href={`${base}/content/new?kind=${kind}`} className="text-xs text-ink-muted hover:text-ink hover:underline">Add</Link> : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm">
            {stats.unpublished > 0 ? <Link href={`${base}/content?status=unpublished`} className="text-action underline">{stats.unpublished} item{stats.unpublished === 1 ? "" : "s"} with unpublished changes</Link> : <span className="text-ink-muted">Everything saved is published.</span>}
          </p>
          {stats.waitingReviews > 0 && (cap.canReview || cap.canEdit) ? <p className="mt-1 text-sm"><Link href={`${base}/reviews`} className="text-action underline">{stats.waitingReviews} waiting for review</Link></p> : null}
        </Card>
        <Card title="Look">
          {config ? (
            <DescriptionList
              items={[
                { term: "Composition", value: composition ?? "—" },
                { term: "Typography", value: typography ?? "—" },
                { term: "Logo", value: config.branding.logoAssetId ? "set" : "wordmark only" },
                { term: "Colours", value: <span className="inline-flex items-center gap-1">{(["primary", "accent", "background", "text"] as const).map((k) => <span key={k} aria-hidden="true" className="inline-block h-4 w-4 border border-line" style={{ background: config.branding.colors[k] }} />)}</span> },
              ]}
            />
          ) : <p className="text-sm text-ink-muted">No configuration yet.</p>}
          {cap.canManageSettings ? <div className="mt-3"><LinkButton variant="secondary" href={`${base}/look`}>Change the look</LinkButton></div> : null}
        </Card>
        <Card title="Publish">
          {stats.latestReleaseVersion ? (
            <p className="text-sm">Live: release v{stats.latestReleaseVersion}, published {formatDateTime(stats.latestReleaseAt, site.timeZone)}.{site.mode === "demo" ? <> <a className="text-action underline" href={`/demo/${site.key}`} target="_blank" rel="noreferrer">Open the site</a></> : null}</p>
          ) : (
            <p className="text-sm text-ink-muted">Not published yet.</p>
          )}
          {preview ? (
            preview.differs ? (
              <p className="mt-2 text-sm">
                <span className="font-medium">{changes} change{changes === 1 ? "" : "s"} ready to publish.</span>
                {blockers ? <span className="text-danger"> {blockers} problem{blockers === 1 ? "" : "s"} to fix first.</span> : null}
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Nothing to publish: the public site is up to date.</p>
            )
          ) : null}
          {waitingApproval > 0 ? <p className="mt-1 text-sm text-ink-muted">{waitingApproval} item{waitingApproval === 1 ? "" : "s"} waiting for approval, not included.</p> : null}
          {cap.canPublish ? <div className="mt-3"><LinkButton href={`${base}/publishing`}>{preview?.differs && !blockers ? "Publish" : "Open Publish"}</LinkButton></div> : null}
          {cap.canViewInquiries ? (
            <p className="mt-3 text-sm">
              {stats.newInquiries > 0 ? <Link href={`${base}/inquiries?status=new`} className="text-action underline">{stats.newInquiries} new inquir{stats.newInquiries === 1 ? "y" : "ies"} in the inbox</Link> : <span className="text-ink-muted">No new inquiries.</span>}
            </p>
          ) : null}
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Setup checklist">
          <SetupChecklist
            base={base}
            config={config}
            site={{ contactEmail: site.contactEmail, recipients: site.inquiryRecipients.length, release: stats.latestReleaseVersion, domains: data.domains, mode: site.mode }}
            kinds={kinds}
            counts={data.counts}
            home={data.home ? { id: data.home.id, heroHasImage, introWritten: homeIntroWritten } : null}
            about={data.about ? { id: data.about.id, written: aboutWritten } : null}
            isOwner={cap.isOwner}
          />
          {hasFixture ? (
            <form action={loadDemoContentAction} className="mt-4 border-t border-line pt-3 text-sm">
              <input type="hidden" name="siteId" value={site.id} />
              <p className="mb-2 text-ink-muted">This is a demonstration site. Loading demo content creates clearly fictional items and images through the normal editing and publishing services{site.demoContentLoadedAt ? ` (last loaded ${formatDateTime(site.demoContentLoadedAt, site.timeZone)})` : ""}. Repeating it updates changed fixtures only.</p>
              <Button type="submit" variant="secondary">{site.demoContentLoadedAt ? "Reload demo content" : "Load demo content"}</Button>
            </form>
          ) : null}
        </Card>
        <Card title="Site facts">
          <DescriptionList
            items={[
              { term: "Registry key", value: <code>{site.key}</code> },
              { term: "Time zone", value: site.timeZone },
              { term: "Contact email", value: site.contactEmail ?? "not set" },
              { term: "Inquiry recipients", value: site.inquiryRecipients.length ? site.inquiryRecipients.join(", ") : "none configured (inquiries are stored but no notification recipients exist)" },
              { term: "Content items", value: stats.items },
              { term: "Review policy", value: site.reviewRequired ? "explicit approval required" : "owners' and publishers' saves are approved on save" },
              { term: "Public route", value: site.mode === "demo" ? <a className="text-action underline" href={`/demo/${site.key}`} target="_blank" rel="noreferrer">/demo/{site.key}</a> : "requires an active verified domain" },
            ]}
          />
        </Card>
      </div>
    </>
  );
}

function SetupChecklist({ base, config, site, kinds, counts, home, about, isOwner }: {
  base: string;
  config: SiteConfig | null;
  site: { contactEmail: string | null; recipients: number; release: number | null; domains: number; mode: "demo" | "live" };
  kinds: ContentKind[];
  counts: Map<ContentKind, number>;
  home: { id: string; heroHasImage: boolean; introWritten: boolean } | null;
  about: { id: string; written: boolean } | null;
  isOwner: boolean;
}) {
  const tasks: Array<{ done: boolean; label: string; href: string }> = [];
  if (config) {
    tasks.push({ done: Boolean(config.branding.logoAssetId), label: "Add a logo (or keep the wordmark on purpose)", href: `${base}/look` });
    tasks.push({ done: config.metadata.defaultDescription.trim().length > 0, label: "Write the site description for search results", href: `${base}/settings#metadata` });
  }
  tasks.push({ done: Boolean(site.contactEmail), label: "Set the contact email", href: `${base}/settings#site-details` });
  if (!config || config.modules.inquiries) tasks.push({ done: site.recipients > 0, label: "Add inquiry notification recipients", href: `${base}/settings#site-details` });
  if (home) tasks.push({ done: home.heroHasImage, label: "Give the home page its hero image", href: `${base}/content/${home.id}` });
  if (home) tasks.push({ done: home.introWritten, label: "Write the home page introduction", href: `${base}/content/${home.id}` });
  if (about) tasks.push({ done: about.written, label: "Write the About page", href: `${base}/content/${about.id}` });
  for (const kind of kinds) {
    if (kind === "page") continue;
    if (config && kind in config.modules && !config.modules[kind as keyof SiteConfig["modules"]]) continue;
    tasks.push({ done: (counts.get(kind) ?? 0) > 0, label: `Add the first ${kindRegistry[kind].plural.toLowerCase()}`, href: `${base}/content/new?kind=${kind}` });
  }
  tasks.push({ done: site.release !== null, label: "Publish the first release", href: `${base}/publishing` });
  if (isOwner) tasks.push({ done: site.domains > 0, label: site.mode === "live" ? "Register the site's domain" : "Register a domain for going live", href: `${base}/settings#domains` });
  const open = tasks.filter((t) => !t.done).length;
  return (
    <>
      <p className="mb-2 text-sm text-ink-muted">{open === 0 ? "Everything on the list is done." : `${open} of ${tasks.length} to do.`}</p>
      <ul className="space-y-2 text-sm">
        {tasks.map((t) => (
          <li key={t.label} className="flex items-start gap-2">
            <span aria-hidden="true" className={`mt-0.5 inline-block h-4 w-4 rounded-sm border ${t.done ? "border-success bg-success" : "border-line-strong"}`} />
            <span className="sr-only">{t.done ? "Done:" : "To do:"}</span>
            {t.done ? <span className="text-ink-muted line-through">{t.label}</span> : <a href={t.href} className="text-action underline">{t.label}</a>}
          </li>
        ))}
      </ul>
    </>
  );
}

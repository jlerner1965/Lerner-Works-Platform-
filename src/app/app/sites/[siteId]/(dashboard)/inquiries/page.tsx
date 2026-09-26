import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { listInquiries } from "@/server/inquiries/inbox";
import { Badge, Button, EmptyState, LinkButton, PageHeader, formatDateTime, inputClass, selectClass } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type Search = { status?: string; from?: string; to?: string; location?: string; page?: string };

export default async function InquiriesPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<Search> }) {
  const { siteId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}/inquiries`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canViewInquiries) notFound();
  const status = (["all", "new", "in_progress", "resolved", "spam"].includes(sp.status ?? "") ? sp.status : "all") as "all" | "new" | "in_progress" | "resolved" | "spam";
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to : undefined;
  const location = /^[0-9a-f-]{36}$/i.test(sp.location ?? "") ? sp.location : undefined;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const { result, locations } = await withUser(user.id, async (db) => ({
    result: await listInquiries(db, { siteId, status, from, to, locationId: location, page }),
    locations: await db<{ id: string; label: string }[]>`select distinct location_id as id, location_label as label from public.inquiries where site_id = ${siteId} and location_id is not null order by 2`,
  }));
  const base = `/app/sites/${siteId}/inquiries`;
  const query = new URLSearchParams(Object.entries({ status, from: from ?? "", to: to ?? "", location: location ?? "" }).filter(([, v]) => v)).toString();
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const tone = (s: string) => (s === "new" ? "info" : s === "in_progress" ? "warning" : s === "resolved" ? "success" : "neutral");
  return (
    <>
      <PageHeader
        eyebrow={ctx.site.name}
        title="Inbox"
        description="Stored submissions from the public forms. Storage and email notification are separate facts: an inquiry can be safely stored while its notification is still pending or failed."
        actions={<LinkButton variant="secondary" href={`/app/sites/${siteId}/inquiries/export?${query}`}>Export CSV</LinkButton>}
      />
      <form method="get" action={base} className="mb-4 flex flex-wrap items-end gap-3 rounded border border-line bg-surface p-3 text-sm">
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-ink-subtle">Status</span>
          <select name="status" defaultValue={status} className={selectClass}>
            <option value="all">All</option><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="spam">Spam</option>
          </select>
        </label>
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-ink-subtle">From</span><input type="date" name="from" defaultValue={from ?? ""} className={inputClass} /></label>
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-ink-subtle">To</span><input type="date" name="to" defaultValue={to ?? ""} className={inputClass} /></label>
        {locations.length ? (
          <label className="flex flex-col gap-1"><span className="text-xs font-medium text-ink-subtle">Location</span>
            <select name="location" defaultValue={location ?? ""} className={selectClass}>
              <option value="">Any</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
        ) : null}
        <Button type="submit" variant="secondary">Apply</Button>
        {(status !== "all" || from || to || location) ? <Link href={base} className="text-action underline">Reset</Link> : null}
      </form>
      {result.rows.length === 0 ? (
        <EmptyState title="No inquiries match" description={status === "all" && !from && !to ? "Submissions from the public site appear here as soon as they are stored." : "Try widening the filters."} />
      ) : (
        <div className="overflow-x-auto rounded border border-line bg-surface">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle"><th className="px-3 py-2">Received</th><th className="px-3 py-2">From</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Message</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Notification</th></tr></thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2"><Link href={`${base}/${r.id}`} className="font-medium hover:underline">{formatDateTime(r.receivedAt, ctx.site.timeZone)}</Link><p className="text-xs text-ink-subtle">{r.receiptCode}{r.isDemoFixture ? " · demo fixture" : ""}</p></td>
                  <td className="px-3 py-2">{r.name}<p className="text-xs text-ink-subtle">{r.email}</p></td>
                  <td className="px-3 py-2">{r.locationLabel ?? "—"}</td>
                  <td className="max-w-md px-3 py-2 text-ink-muted">{r.message.length > 120 ? `${r.message.slice(0, 120)}…` : r.message}</td>
                  <td className="px-3 py-2"><Badge tone={tone(r.status)}>{r.status.replace("_", " ")}</Badge></td>
                  <td className="px-3 py-2"><Badge tone={r.delivery === "delivered" ? "success" : r.delivery === "failed" ? "danger" : "neutral"}>{r.delivery ?? "none"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-subtle">{result.total} inquir{result.total === 1 ? "y" : "ies"}{pages > 1 ? ` · page ${page} of ${pages}` : ""}</p>
      {pages > 1 ? <nav aria-label="Pagination" className="mt-2 flex gap-3 text-sm">{page > 1 ? <Link href={`${base}?${query}&page=${page - 1}`} className="text-action underline">Previous</Link> : null}{page < pages ? <Link href={`${base}?${query}&page=${page + 1}`} className="text-action underline">Next</Link> : null}</nav> : null}
    </>
  );
}

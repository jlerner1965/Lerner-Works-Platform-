import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getInquiry } from "@/server/inquiries/inbox";
import { Badge, Card, DescriptionList, PageHeader, formatDateTime } from "@/components/admin/ui";
import { InquiryStatusForm, RetryDeliveryForm } from "@/components/admin/inquiry-forms";

export const dynamic = "force-dynamic";

export default async function InquiryDetailPage({ params }: { params: Promise<{ siteId: string; inquiryId: string }> }) {
  const { siteId, inquiryId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/inquiries/${inquiryId}`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canViewInquiries) notFound();
  const data = await withUser(user.id, (db) => getInquiry(db, inquiryId));
  if (!data || data.inquiry.siteId !== siteId) notFound();
  const { inquiry, jobs } = data;
  const base = `/app/sites/${siteId}/inquiries`;
  return (
    <>
      <PageHeader eyebrow={`${ctx.site.name} · Inquiries`} title={`Inquiry ${inquiry.receiptCode}`} description={<Link href={base} className="text-action underline">← Inbox</Link>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Submission">
          {inquiry.isDemoFixture ? <p className="mb-2"><Badge tone="warning">Demonstration fixture</Badge></p> : null}
          <DescriptionList
            items={[
              { term: "Received", value: formatDateTime(inquiry.receivedAt, ctx.site.timeZone) },
              { term: "Name", value: inquiry.name },
              { term: "Email", value: <a href={`mailto:${inquiry.email}`} className="text-action underline">{inquiry.email}</a> },
              { term: "Phone", value: inquiry.phone ?? "—" },
              { term: "Location", value: inquiry.locationLabel ?? "General inquiry" },
              { term: "Source page", value: inquiry.sourcePath ?? "—" },
              { term: "Consent notice", value: inquiry.consentVersion ?? "not recorded" },
            ]}
          />
          <p className="mt-3 whitespace-pre-wrap rounded border border-line bg-surface-muted p-3 text-sm">{inquiry.message}</p>
        </Card>
        <div className="space-y-4">
          <Card title="Status">
            <InquiryStatusForm siteId={siteId} inquiryId={inquiry.id} status={inquiry.status} notes={inquiry.notes ?? ""} />
          </Card>
          <Card title="Notification delivery">
            {jobs.length === 0 ? <p className="text-sm text-ink-muted">No notification job exists for this inquiry.</p> : (
              <ul className="space-y-3 text-sm">
                {jobs.map((j) => (
                  <li key={j.id} className="rounded border border-line p-3">
                    <p><Badge tone={j.state === "delivered" ? "success" : j.state === "failed" ? "danger" : j.state === "processing" ? "warning" : "neutral"}>{j.state}</Badge> <span className="text-ink-subtle">attempt {j.attemptCount} of {j.maxAttempts}</span></p>
                    <DescriptionList
                      items={[
                        { term: "Recipients", value: j.recipients.length ? j.recipients.join(", ") : "none configured (set recipients in Settings)" },
                        { term: "Provider", value: j.provider ? `${j.provider}${j.providerAccepted === true ? " · accepted" : j.providerAccepted === false ? " · rejected" : ""}` : "not attempted yet" },
                        { term: "Reference", value: j.providerReference ?? "—" },
                        { term: "Delivered", value: j.deliveredAt ? formatDateTime(j.deliveredAt, ctx.site.timeZone) : "—" },
                        { term: "Next attempt", value: j.state === "pending" ? formatDateTime(j.nextAttemptAt, ctx.site.timeZone) : "—" },
                        { term: "Last error", value: j.lastError ?? "—" },
                      ]}
                    />
                    {j.state === "failed" && ctx.capabilities.canPublish ? <div className="mt-2"><RetryDeliveryForm siteId={siteId} inquiryId={inquiry.id} jobId={j.id} /></div> : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-subtle">Local mode writes notifications to the local sink; that proves job processing, not internet email delivery.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

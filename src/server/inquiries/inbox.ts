import type { Db } from "@/server/data/db";

export interface InquiryRow {
  id: string;
  siteId: string;
  organizationId: string;
  receiptCode: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  sourcePath: string | null;
  locationId: string | null;
  locationLabel: string | null;
  consentVersion: string | null;
  status: "new" | "in_progress" | "resolved" | "spam";
  isDemoFixture: boolean;
  notes: string | null;
  receivedAt: Date;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface DeliveryJobRow {
  id: string;
  inquiryId: string;
  state: "pending" | "processing" | "delivered" | "failed";
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  recipients: string[];
  provider: string | null;
  providerReference: string | null;
  providerAccepted: boolean | null;
  lastError: string | null;
  deliveredAt: Date | null;
  updatedAt: Date;
}

export interface InboxFilter {
  siteId: string;
  status?: InquiryRow["status"] | "all";
  from?: string;
  to?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
}

export async function listInquiries(db: Db, f: InboxFilter): Promise<{ rows: Array<InquiryRow & { delivery: DeliveryJobRow["state"] | null }>; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 25));
  const status = f.status && f.status !== "all" ? f.status : null;
  const rows = await db<Array<InquiryRow & { delivery: DeliveryJobRow["state"] | null; total: number }>>`
    select i.*, (select j.state::text from public.delivery_jobs j where j.inquiry_id = i.id order by j.created_at desc limit 1) as delivery, count(*) over() as total
    from public.inquiries i
    where i.site_id = ${f.siteId}
      ${status ? db`and i.status = ${status}` : db``}
      ${f.from ? db`and i.received_at >= ${f.from}::date` : db``}
      ${f.to ? db`and i.received_at < (${f.to}::date + interval '1 day')` : db``}
      ${f.locationId ? db`and i.location_id = ${f.locationId}` : db``}
    order by i.received_at desc
    limit ${pageSize} offset ${(page - 1) * pageSize}`;
  const total = rows[0] ? Number(rows[0].total) : 0;
  return { rows: rows.map(({ total: _t, ...r }) => r as InquiryRow & { delivery: DeliveryJobRow["state"] | null }), total, page, pageSize };
}

export async function getInquiry(db: Db, id: string): Promise<{ inquiry: InquiryRow; jobs: DeliveryJobRow[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [inquiry] = await db<InquiryRow[]>`select * from public.inquiries where id = ${id}`;
  if (!inquiry) return null;
  const jobs = await db<DeliveryJobRow[]>`select * from public.delivery_jobs where inquiry_id = ${id} order by created_at`;
  return { inquiry, jobs };
}

/** Escapes a CSV cell, neutralizing spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function inquiriesToCsv(rows: Array<InquiryRow & { delivery?: string | null }>): string {
  const header = ["receipt", "received_at_utc", "status", "name", "email", "phone", "location", "source_path", "message", "delivery", "demo_fixture"];
  const lines = rows.map((r) => [r.receiptCode, r.receivedAt, r.status, r.name, r.email, r.phone ?? "", r.locationLabel ?? "", r.sourcePath ?? "", r.message, r.delivery ?? "", r.isDemoFixture ? "yes" : "no"].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}

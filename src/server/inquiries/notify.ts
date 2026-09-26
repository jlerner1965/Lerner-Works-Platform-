import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "@/server/config";

export interface NotificationMessage {
  to: string[];
  subject: string;
  text: string;
  /** Stable key so a retried send after a timeout can be deduplicated by providers that support it. */
  idempotencyKey: string;
}

export type SendResult = { ok: true; reference: string; accepted: boolean; note?: string } | { ok: false; error: string; transient: boolean };

export interface NotificationProvider {
  readonly name: string;
  send(message: NotificationMessage): Promise<SendResult>;
}

/** Writes each message to a local directory. Proves job processing, not internet email delivery. */
export class LocalSinkProvider implements NotificationProvider {
  readonly name = "local-sink";
  constructor(private readonly dir: string) {}
  async send(message: NotificationMessage): Promise<SendResult> {
    await fs.mkdir(this.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeKey = message.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    const file = path.join(this.dir, `${stamp}-${safeKey}.txt`);
    const body = [`To: ${message.to.join(", ")}`, `Subject: ${message.subject}`, `Date: ${new Date().toUTCString()}`, `X-Idempotency-Key: ${message.idempotencyKey}`, "", message.text, ""].join("\n");
    await fs.writeFile(file, body, "utf8");
    return { ok: true, reference: path.basename(file), accepted: true, note: "Local notification log; no email was sent." };
  }
}

/** Always fails; used by tests to prove failure handling and retries. */
export class FailingProvider implements NotificationProvider {
  readonly name = "failing";
  constructor(private readonly transient = true) {}
  async send(): Promise<SendResult> {
    return { ok: false, error: "simulated provider outage", transient: this.transient };
  }
}

/** Resend transactional email. Unverified in this environment: no API key exists here. */
export class ResendProvider implements NotificationProvider {
  readonly name = "resend";
  constructor(private readonly apiKey: string, private readonly from: string) {}
  async send(message: NotificationMessage): Promise<SendResult> {
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": message.idempotencyKey },
        body: JSON.stringify({ from: this.from, to: message.to, subject: message.subject, text: message.text }),
      });
    } catch (err) {
      return { ok: false, error: `network error: ${(err as Error).message}`, transient: true };
    }
    if (res.status >= 500 || res.status === 429) return { ok: false, error: `provider responded ${res.status}`, transient: true };
    if (!res.ok) return { ok: false, error: `provider rejected the message (${res.status})`, transient: false };
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    // Acceptance by the API is not confirmed delivery; no delivery webhook is configured.
    return { ok: true, reference: body.id ?? "accepted", accepted: true, note: "Accepted by provider; delivery not confirmed." };
  }
}

export function getNotificationProvider(): NotificationProvider {
  const cfg = getConfig();
  if (cfg.NOTIFY_PROVIDER === "local-sink") return new LocalSinkProvider(path.resolve(process.cwd(), cfg.NOTIFY_LOCAL_DIR));
  if (!cfg.NOTIFY_RESEND_API_KEY) {
    throw new Error("NOTIFY_PROVIDER=resend requires NOTIFY_RESEND_API_KEY. Configure it in the hosting provider's secret settings.");
  }
  return new ResendProvider(cfg.NOTIFY_RESEND_API_KEY, cfg.NOTIFY_FROM_ADDRESS);
}

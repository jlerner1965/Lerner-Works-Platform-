import { getConfig } from "@/server/config";
import { VercelDomainProvider } from "@/server/domains/vercel";

/** A DNS record the hosting provider asked for, exactly as the provider returned it. */
export interface DomainRecordInstruction {
  type: string;
  name: string;
  value: string;
  reason?: string;
}

/**
 * Provider-reported facts about a hostname. `verified` is ownership/verification status as
 * the provider reports it; `configured` is whether the provider sees DNS pointing at it
 * (null when the provider did not say). Activation in the dashboard requires both.
 */
export interface DomainProviderStatus {
  provider: string;
  registered: boolean;
  verified: boolean;
  configured: boolean | null;
  configuredBy: string | null;
  verification: DomainRecordInstruction[];
  recommended: DomainRecordInstruction[];
  checkedAt: string;
  note?: string;
}

export interface DomainHostingProvider {
  readonly name: string;
  /** Registers the hostname with the hosting project (idempotent) and reports its status. */
  register(host: string): Promise<DomainProviderStatus>;
  /** Reports the current provider status without changing anything. */
  status(host: string): Promise<DomainProviderStatus>;
  /** Removes the hostname from the hosting project (idempotent). */
  remove(host: string): Promise<void>;
}

export class DomainProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DomainProviderError";
  }
}

/** The configured hosting provider, or null when none is configured (local development). */
export function getDomainProvider(): DomainHostingProvider | null {
  const cfg = getConfig();
  if (cfg.VERCEL_API_TOKEN && cfg.VERCEL_PROJECT_ID) {
    return new VercelDomainProvider(cfg.VERCEL_API_TOKEN, cfg.VERCEL_PROJECT_ID, cfg.VERCEL_TEAM_ID);
  }
  return null;
}

/** True when a provider status allows activation: verified ownership and DNS in place. */
export function readyToActivate(status: DomainProviderStatus): boolean {
  return status.registered && status.verified && status.configured === true;
}

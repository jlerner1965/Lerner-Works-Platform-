import { DomainProviderError, type DomainHostingProvider, type DomainProviderStatus, type DomainRecordInstruction } from "@/server/domains/provider";

/**
 * Customer domains on a Vercel project through the Vercel REST API (project domains and
 * domain configuration endpoints). Every DNS value shown to owners comes from these
 * responses; nothing is inferred locally. `fetchImpl` is injectable for tests. The endpoints
 * follow Vercel's published API reference; they have not been exercised against a live
 * project from this repository (see docs/RELEASE-REPORT.md).
 */

interface ProjectDomain {
  name: string;
  apexName?: string;
  verified?: boolean;
  verification?: Array<{ type: string; domain: string; value: string; reason?: string }>;
}

interface DomainConfig {
  configuredBy?: string | null;
  misconfigured?: boolean;
  recommendedCNAME?: Array<{ rank?: number; value: string }>;
  recommendedIPv4?: Array<{ rank?: number; value: string[] }>;
}

interface ApiError {
  error?: { code?: string; message?: string };
}

export class VercelDomainProvider implements DomainHostingProvider {
  readonly name = "vercel";

  constructor(
    private readonly token: string,
    private readonly projectId: string,
    private readonly teamId?: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = "https://api.vercel.com",
  ) {}

  private url(path: string): string {
    const u = new URL(path, this.baseUrl);
    if (this.teamId) u.searchParams.set("teamId", this.teamId);
    return u.toString();
  }

  private async call(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(path), {
        method,
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new DomainProviderError(`the hosting provider could not be reached: ${(err as Error).message}`);
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  }

  private static fail(status: number, json: unknown, fallback: string): DomainProviderError {
    const e = (json as ApiError | null)?.error;
    return new DomainProviderError(e?.message ? `${fallback}: ${e.message}${e.code ? ` (${e.code})` : ""}` : `${fallback} (status ${status})`, status);
  }

  private static instructions(d: ProjectDomain | null): DomainRecordInstruction[] {
    return (d?.verification ?? []).map((v) => ({ type: v.type, name: v.domain, value: v.value, reason: v.reason }));
  }

  private static recommended(host: string, c: DomainConfig | null): DomainRecordInstruction[] {
    const out: DomainRecordInstruction[] = [];
    for (const r of c?.recommendedCNAME ?? []) if (r.value) out.push({ type: "CNAME", name: host, value: r.value });
    for (const r of c?.recommendedIPv4 ?? []) for (const ip of r.value ?? []) out.push({ type: "A", name: host, value: ip });
    return out;
  }

  private async projectDomain(host: string): Promise<ProjectDomain | null> {
    const { status, json } = await this.call("GET", `/v9/projects/${encodeURIComponent(this.projectId)}/domains/${encodeURIComponent(host)}`);
    if (status === 404) return null;
    if (status >= 400) throw VercelDomainProvider.fail(status, json, `the hosting provider could not report ${host}`);
    return json as ProjectDomain;
  }

  private async domainConfig(host: string): Promise<DomainConfig | null> {
    const { status, json } = await this.call("GET", `/v6/domains/${encodeURIComponent(host)}/config`);
    if (status >= 400) return null;
    return json as DomainConfig;
  }

  private async compose(host: string, domain: ProjectDomain | null): Promise<DomainProviderStatus> {
    const config = domain ? await this.domainConfig(host) : null;
    return {
      provider: this.name,
      registered: domain !== null,
      verified: domain?.verified === true,
      configured: config ? !config.misconfigured : null,
      configuredBy: config?.configuredBy ?? null,
      verification: VercelDomainProvider.instructions(domain),
      recommended: VercelDomainProvider.recommended(host, config),
      checkedAt: new Date().toISOString(),
      note: domain === null ? "The hostname is not registered on the hosting project." : undefined,
    };
  }

  async register(host: string): Promise<DomainProviderStatus> {
    const { status, json } = await this.call("POST", `/v10/projects/${encodeURIComponent(this.projectId)}/domains`, { name: host });
    if (status === 200 || status === 201) return this.compose(host, json as ProjectDomain);
    const code = (json as ApiError | null)?.error?.code;
    if (status === 409 || code === "domain_already_exists") return this.status(host);
    throw VercelDomainProvider.fail(status, json, `the hosting provider refused ${host}`);
  }

  async status(host: string): Promise<DomainProviderStatus> {
    const domain = await this.projectDomain(host);
    if (domain && domain.verified !== true) {
      // Ask the provider to re-check pending verification challenges; the answer is authoritative.
      const { status, json } = await this.call("POST", `/v9/projects/${encodeURIComponent(this.projectId)}/domains/${encodeURIComponent(host)}/verify`);
      if (status === 200 && json && typeof json === "object") return this.compose(host, json as ProjectDomain);
    }
    return this.compose(host, domain);
  }

  async remove(host: string): Promise<void> {
    const { status, json } = await this.call("DELETE", `/v9/projects/${encodeURIComponent(this.projectId)}/domains/${encodeURIComponent(host)}`);
    if (status === 200 || status === 204 || status === 404) return;
    throw VercelDomainProvider.fail(status, json, `the hosting provider could not remove ${host}`);
  }
}

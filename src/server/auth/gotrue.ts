/**
 * Minimal client for the Supabase Auth (GoTrue) HTTP API: password sign-in, administrative
 * user creation for invitations, and the PKCE password-recovery flow. The platform never
 * stores GoTrue tokens in the browser; it verifies credentials here and issues its own
 * session (see supabase-provider.ts). `fetchImpl` is injectable for tests.
 *
 * Endpoints follow the GoTrue v2 API as documented for supabase-js; they have not been
 * exercised against a live project from this repository (see docs/RELEASE-REPORT.md).
 */

export interface GoTrueUser {
  id: string;
  email: string;
}

export interface GoTrueSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: GoTrueUser;
}

export type SignInOutcome = { ok: true; session: GoTrueSession } | { ok: false; reason: "invalid_credentials" | "unavailable"; status?: number };
export type CreateUserOutcome = { ok: true; user: GoTrueUser } | { ok: false; reason: "exists" | "rejected" | "unavailable"; message: string };
export type ExchangeOutcome = { ok: true; session: GoTrueSession } | { ok: false; reason: "invalid_code" | "unavailable"; message: string };

interface ErrorBody {
  code?: number | string;
  error_code?: string;
  msg?: string;
  message?: string;
  error?: string;
  error_description?: string;
}

function describe(body: ErrorBody | null, status: number): string {
  return body?.msg ?? body?.message ?? body?.error_description ?? body?.error ?? `provider responded ${status}`;
}

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function parseSession(body: unknown): GoTrueSession | null {
  const b = body as { access_token?: string; refresh_token?: string; expires_in?: number; user?: { id?: string; email?: string } } | null;
  if (!b?.access_token || !b.user?.id) return null;
  return { accessToken: b.access_token, refreshToken: b.refresh_token ?? "", expiresIn: b.expires_in ?? 3600, user: { id: b.user.id, email: (b.user.email ?? "").toLowerCase() } };
}

export class GoTrueClient {
  constructor(
    private readonly baseUrl: string,
    private readonly anonKey: string,
    private readonly serviceRoleKey: string | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private url(path: string, query?: Record<string, string>): string {
    const u = new URL(`/auth/v1/${path}`, this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    for (const [k, v] of Object.entries(query ?? {})) u.searchParams.set(k, v);
    return u.toString();
  }

  private headers(bearer: string, extra: Record<string, string> = {}): Record<string, string> {
    return { apikey: bearer, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", ...extra };
  }

  private admin(): string {
    if (!this.serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for administrative auth operations.");
    return this.serviceRoleKey;
  }

  /** Verifies an email/password pair. Never reveals whether the email exists. */
  async signInWithPassword(email: string, password: string): Promise<SignInOutcome> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url("token", { grant_type: "password" }), {
        method: "POST",
        headers: this.headers(this.anonKey),
        body: JSON.stringify({ email, password }),
      });
    } catch {
      return { ok: false, reason: "unavailable" };
    }
    if (res.ok) {
      const session = parseSession(await readJson(res));
      return session ? { ok: true, session } : { ok: false, reason: "unavailable", status: res.status };
    }
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) return { ok: false, reason: "invalid_credentials", status: res.status };
    return { ok: false, reason: "unavailable", status: res.status };
  }

  /** Creates a confirmed user with a password (service role). Used for accepted invitations. */
  async adminCreateUser(email: string, password: string): Promise<CreateUserOutcome> {
    const serviceKey = this.admin();
    let res: Response;
    try {
      res = await this.fetchImpl(this.url("admin/users"), {
        method: "POST",
        headers: this.headers(serviceKey),
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
    } catch (err) {
      return { ok: false, reason: "unavailable", message: `network error: ${(err as Error).message}` };
    }
    const body = await readJson<ErrorBody & { id?: string; email?: string }>(res);
    if (res.ok && body?.id) return { ok: true, user: { id: body.id, email: (body.email ?? email).toLowerCase() } };
    const message = describe(body, res.status);
    if (res.status === 422 && (body?.error_code === "email_exists" || /already|exists/i.test(message))) return { ok: false, reason: "exists", message };
    if (res.status >= 500 || res.status === 429) return { ok: false, reason: "unavailable", message };
    return { ok: false, reason: "rejected", message };
  }

  /**
   * Starts PKCE password recovery: GoTrue emails a link that returns to `redirectTo` with a
   * one-time code. Responds identically whether or not the address is registered.
   */
  async requestPasswordRecovery(email: string, redirectTo: string, codeChallenge: string): Promise<{ ok: boolean; message?: string }> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url("recover", { redirect_to: redirectTo }), {
        method: "POST",
        headers: this.headers(this.anonKey),
        body: JSON.stringify({ email, code_challenge: codeChallenge, code_challenge_method: "s256" }),
      });
    } catch (err) {
      return { ok: false, message: `network error: ${(err as Error).message}` };
    }
    if (res.ok) return { ok: true };
    return { ok: false, message: describe(await readJson<ErrorBody>(res), res.status) };
  }

  /** Exchanges the recovery code for a session using the stored PKCE verifier. */
  async exchangeCodeForSession(code: string, codeVerifier: string): Promise<ExchangeOutcome> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url("token", { grant_type: "pkce" }), {
        method: "POST",
        headers: this.headers(this.anonKey),
        body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier }),
      });
    } catch (err) {
      return { ok: false, reason: "unavailable", message: `network error: ${(err as Error).message}` };
    }
    const body = await readJson(res);
    if (res.ok) {
      const session = parseSession(body);
      return session ? { ok: true, session } : { ok: false, reason: "unavailable", message: "unexpected provider response" };
    }
    const message = describe(body as ErrorBody, res.status);
    if (res.status >= 500 || res.status === 429) return { ok: false, reason: "unavailable", message };
    return { ok: false, reason: "invalid_code", message };
  }

  /**
   * Verifies a recovery token hash delivered by email (the `{{ .TokenHash }}` template
   * variable) and returns a session. Works from any browser, unlike the PKCE code flow.
   */
  async verifyRecoveryTokenHash(tokenHash: string): Promise<ExchangeOutcome> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url("verify"), {
        method: "POST",
        headers: this.headers(this.anonKey),
        body: JSON.stringify({ type: "recovery", token_hash: tokenHash }),
      });
    } catch (err) {
      return { ok: false, reason: "unavailable", message: `network error: ${(err as Error).message}` };
    }
    const body = await readJson(res);
    if (res.ok) {
      const session = parseSession(body);
      return session ? { ok: true, session } : { ok: false, reason: "unavailable", message: "unexpected provider response" };
    }
    const message = describe(body as ErrorBody, res.status);
    if (res.status >= 500 || res.status === 429) return { ok: false, reason: "unavailable", message };
    return { ok: false, reason: "invalid_code", message };
  }

  /** Sets a new password for the user identified by a valid access token. */
  async updatePassword(accessToken: string, password: string): Promise<{ ok: boolean; message?: string }> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url("user"), {
        method: "PUT",
        headers: { apikey: this.anonKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch (err) {
      return { ok: false, message: `network error: ${(err as Error).message}` };
    }
    if (res.ok) return { ok: true };
    return { ok: false, message: describe(await readJson<ErrorBody>(res), res.status) };
  }

  /** Public auth settings; used by the launch check to confirm sign-ups are disabled. */
  async settings(): Promise<{ ok: true; disableSignup: boolean | null; externalEmail: boolean | null } | { ok: false; message: string }> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url("settings"), { headers: { apikey: this.anonKey } });
    } catch (err) {
      return { ok: false, message: `network error: ${(err as Error).message}` };
    }
    if (!res.ok) return { ok: false, message: `provider responded ${res.status}` };
    const body = await readJson<{ disable_signup?: boolean; external?: { email?: boolean } }>(res);
    return { ok: true, disableSignup: body?.disable_signup ?? null, externalEmail: body?.external?.email ?? null };
  }
}

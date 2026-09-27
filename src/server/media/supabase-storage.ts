import { assertSafeKey, type StorageProvider } from "@/server/media/storage";

/**
 * Supabase Storage over its HTTP API with the service-role key (server only). Private objects
 * live in a non-public bucket and are read through the authenticated endpoint; published
 * derivatives go to a public bucket under immutable content-hash names and are served by
 * the bucket's public URL. `fetchImpl` is injectable for tests. The endpoints follow the
 * Storage API used by storage-js; they have not been exercised against a live project from
 * this repository (see docs/RELEASE-REPORT.md).
 */

export class SupabaseStorageError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SupabaseStorageError";
  }
}

interface ListEntry {
  name: string;
  id: string | null;
}

function encodePath(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string; statusCode?: string };
    return body.message ?? body.error ?? `status ${res.status}`;
  } catch {
    return `status ${res.status}`;
  }
}

async function isNotFound(res: Response): Promise<boolean> {
  if (res.status === 404) return true;
  if (res.status !== 400) return false;
  const text = await res.clone().text();
  return /not.?found|404/i.test(text);
}

export class SupabaseStorage implements StorageProvider {
  readonly name = "supabase" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
    private readonly buckets: { private: string; public: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private api(path: string): string {
    const base = this.baseUrl.endsWith("/") ? this.baseUrl.slice(0, -1) : this.baseUrl;
    return `${base}/storage/v1/${path}`;
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }

  async putPrivate(key: string, data: Uint8Array, contentType: string): Promise<void> {
    assertSafeKey(key);
    const res = await this.fetchImpl(this.api(`object/${this.buckets.private}/${encodePath(key)}`), {
      method: "POST",
      headers: this.authHeaders({ "Content-Type": contentType, "x-upsert": "true", "cache-control": "max-age=0" }),
      body: data as BodyInit,
    });
    if (!res.ok) throw new SupabaseStorageError(`private upload failed for ${key}: ${await errorMessage(res)}`, res.status);
  }

  async getPrivate(key: string): Promise<Uint8Array | null> {
    assertSafeKey(key);
    const res = await this.fetchImpl(this.api(`object/authenticated/${this.buckets.private}/${encodePath(key)}`), { headers: this.authHeaders() });
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    if (await isNotFound(res)) return null;
    throw new SupabaseStorageError(`private download failed for ${key}: ${await errorMessage(res)}`, res.status);
  }

  /** Lists every object below a prefix, descending into folders (Storage lists one level at a time). */
  private async listRecursive(prefix: string, budget = { remaining: 5000 }): Promise<string[]> {
    const out: string[] = [];
    let offset = 0;
    for (;;) {
      const res = await this.fetchImpl(this.api(`object/list/${this.buckets.private}`), {
        method: "POST",
        headers: this.authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
      });
      if (!res.ok) throw new SupabaseStorageError(`listing ${prefix} failed: ${await errorMessage(res)}`, res.status);
      const entries = (await res.json()) as ListEntry[];
      for (const e of entries) {
        if (budget.remaining-- <= 0) throw new SupabaseStorageError(`listing ${prefix} exceeded the safety budget`, 0);
        const path = `${prefix}/${e.name}`;
        if (e.id === null) out.push(...(await this.listRecursive(path, budget)));
        else out.push(path);
      }
      if (entries.length < 1000) break;
      offset += entries.length;
    }
    return out;
  }

  async deletePrivatePrefix(prefix: string): Promise<void> {
    assertSafeKey(prefix);
    const paths = await this.listRecursive(prefix);
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const res = await this.fetchImpl(this.api(`object/${this.buckets.private}`), {
        method: "DELETE",
        headers: this.authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prefixes: chunk }),
      });
      if (!res.ok) throw new SupabaseStorageError(`deleting ${prefix} failed: ${await errorMessage(res)}`, res.status);
    }
  }

  async putPublic(name: string, data: Uint8Array, contentType: string): Promise<void> {
    assertSafeKey(name);
    if (name.includes("/")) throw new Error("public names are flat");
    const res = await this.fetchImpl(this.api(`object/${this.buckets.public}/${encodeURIComponent(name)}`), {
      method: "POST",
      headers: this.authHeaders({ "Content-Type": contentType, "x-upsert": "false", "cache-control": "max-age=31536000" }),
      body: data as BodyInit,
    });
    if (res.ok) return;
    // Content-hash names are immutable: an existing object holds identical bytes.
    if (res.status === 409) return;
    const message = await errorMessage(res);
    if (res.status === 400 && /duplicate|already exists/i.test(message)) return;
    throw new SupabaseStorageError(`public upload failed for ${name}: ${message}`, res.status);
  }

  async getPublic(name: string): Promise<Uint8Array | null> {
    assertSafeKey(name);
    const res = await this.fetchImpl(this.publicUrl(name));
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    if (await isNotFound(res)) return null;
    throw new SupabaseStorageError(`public download failed for ${name}: ${await errorMessage(res)}`, res.status);
  }

  async existsPublic(name: string): Promise<boolean> {
    assertSafeKey(name);
    const res = await this.fetchImpl(this.publicUrl(name), { method: "HEAD" });
    if (res.ok) return true;
    if (res.status === 404 || res.status === 400) return false;
    throw new SupabaseStorageError(`public existence check failed for ${name}: status ${res.status}`, res.status);
  }

  async deletePublic(names: string[]): Promise<void> {
    for (const name of names) {
      assertSafeKey(name);
      if (name.includes("/")) throw new Error("public names are flat");
    }
    for (let i = 0; i < names.length; i += 100) {
      const chunk = names.slice(i, i + 100);
      const res = await this.fetchImpl(this.api(`object/${this.buckets.public}`), {
        method: "DELETE",
        headers: this.authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prefixes: chunk }),
      });
      if (!res.ok) throw new SupabaseStorageError(`deleting ${chunk.length} public object(s) failed: ${await errorMessage(res)}`, res.status);
    }
  }

  publicUrl(name: string): string {
    assertSafeKey(name);
    return this.api(`object/public/${this.buckets.public}/${encodeURIComponent(name)}`);
  }

  /** Bucket metadata for the launch check: exists and whether it is public. */
  async describeBucket(name: string): Promise<{ exists: boolean; isPublic: boolean | null; message?: string }> {
    const res = await this.fetchImpl(this.api(`bucket/${encodeURIComponent(name)}`), { headers: this.authHeaders() });
    if (res.status === 404) return { exists: false, isPublic: null };
    if (!res.ok) return { exists: false, isPublic: null, message: await errorMessage(res) };
    const body = (await res.json()) as { public?: boolean };
    return { exists: true, isPublic: body.public ?? null };
  }
}

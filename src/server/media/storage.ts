import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "@/server/config";
import { SupabaseStorage } from "@/server/media/supabase-storage";

/**
 * Object storage behind a small interface. Private objects hold originals and derivatives
 * under organization/site-scoped keys assigned by the server; public objects are immutable
 * content-hash derivatives copied at publication time.
 */
export interface StorageProvider {
  readonly name: "local" | "supabase";
  putPrivate(key: string, data: Uint8Array, contentType: string): Promise<void>;
  getPrivate(key: string): Promise<Uint8Array | null>;
  deletePrivatePrefix(prefix: string): Promise<void>;
  putPublic(name: string, data: Uint8Array, contentType: string): Promise<void>;
  getPublic(name: string): Promise<Uint8Array | null>;
  existsPublic(name: string): Promise<boolean>;
  /** Removes published copies by name (site removal, B6); a name that is already gone is not an error. */
  deletePublic(names: string[]): Promise<void>;
  /** Public URL path for a published derivative (served by /assets/[name] locally). */
  publicUrl(name: string): string;
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

export function assertSafeKey(key: string): void {
  const parts = key.split("/");
  if (parts.length === 0 || parts.some((p) => !SAFE_SEGMENT.test(p) || p === "." || p === "..")) {
    throw new Error(`unsafe storage key: ${key}`);
  }
}

class LocalDiskStorage implements StorageProvider {
  readonly name = "local" as const;
  constructor(private readonly root: string) {}

  private privatePath(key: string): string {
    assertSafeKey(key);
    return path.join(this.root, "private", ...key.split("/"));
  }
  private publicPath(name: string): string {
    assertSafeKey(name);
    if (name.includes("/")) throw new Error("public names are flat");
    return path.join(this.root, "public", name);
  }

  async putPrivate(key: string, data: Uint8Array): Promise<void> {
    const p = this.privatePath(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }
  async getPrivate(key: string): Promise<Uint8Array | null> {
    try {
      return await fs.readFile(this.privatePath(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
  async deletePrivatePrefix(prefix: string): Promise<void> {
    const p = this.privatePath(prefix);
    await fs.rm(p, { recursive: true, force: true });
  }
  async putPublic(name: string, data: Uint8Array): Promise<void> {
    const p = this.publicPath(name);
    await fs.mkdir(path.dirname(p), { recursive: true });
    const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, p);
  }
  async getPublic(name: string): Promise<Uint8Array | null> {
    try {
      return await fs.readFile(this.publicPath(name));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
  async existsPublic(name: string): Promise<boolean> {
    try {
      await fs.access(this.publicPath(name));
      return true;
    } catch {
      return false;
    }
  }
  async deletePublic(names: string[]): Promise<void> {
    for (const name of names) await fs.rm(this.publicPath(name), { force: true });
  }
  publicUrl(name: string): string {
    assertSafeKey(name);
    return `/assets/${name}`;
  }
}

declare global {
  var __lwStorage: StorageProvider | undefined;
}

export function getStorage(): StorageProvider {
  if (!globalThis.__lwStorage) {
    const cfg = getConfig();
    if (cfg.STORAGE_PROVIDER === "local") {
      globalThis.__lwStorage = new LocalDiskStorage(path.resolve(process.cwd(), cfg.STORAGE_LOCAL_DIR));
    } else {
      if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY) throw new Error("STORAGE_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
      globalThis.__lwStorage = new SupabaseStorage(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
        private: cfg.SUPABASE_STORAGE_PRIVATE_BUCKET,
        public: cfg.SUPABASE_STORAGE_PUBLIC_BUCKET,
      });
    }
  }
  return globalThis.__lwStorage;
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { getDomainProvider, readyToActivate, DomainProviderError, type DomainProviderStatus } from "@/server/domains/provider";

const uuid = z.uuid();

export interface DomainActionState {
  message?: string;
  error?: string;
}

const INTENTS = ["register", "check", "activate", "disable", "canonical", "remove"] as const;
type Intent = (typeof INTENTS)[number];

interface DomainRow {
  id: string;
  siteId: string;
  normalizedHost: string;
  status: "pending" | "verifying" | "active" | "disabled";
  isCanonical: boolean;
  verifiedAt: Date | null;
}

function fail(err: unknown): DomainActionState {
  if (err instanceof DomainProviderError) return { error: err.message };
  return { error: describeDbError(err).message };
}

/**
 * Owner-only domain workflow. Verification facts come from the hosting provider's API and
 * are stored by set_domain_verification; activation, canonical choice, disabling and
 * removal run through the corresponding SQL functions, which re-check ownership and record
 * audit events.
 */
export async function domainAction(_prev: DomainActionState, formData: FormData): Promise<DomainActionState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const domainId = String(formData.get("domainId") ?? "");
  const intent = String(formData.get("intent") ?? "") as Intent;
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(domainId).success || !INTENTS.includes(intent)) return { error: "Invalid request." };

  const found = await withUser(user.id, async (db) => {
    const ctx = await loadSiteContext(db, siteId);
    if (!ctx?.capabilities.isOwner) return null;
    const rows = await db<DomainRow[]>`select id, site_id, normalized_host, status::text, is_canonical, verified_at from public.domains where id = ${domainId} and site_id = ${siteId}`;
    return rows[0] ?? null;
  });
  if (!found) return { error: "Only organization owners manage domains, and the domain must belong to this site." };
  const host = found.normalizedHost;

  try {
    let message: string;
    switch (intent) {
      case "register":
      case "check": {
        const provider = getDomainProvider();
        if (!provider) {
          return { error: "No hosting provider is configured for domain verification here. In the hosted environment set VERCEL_API_TOKEN and VERCEL_PROJECT_ID (docs/LAUNCH-CHECKLIST.md); nothing is marked verified without the provider's confirmation." };
        }
        const status: DomainProviderStatus = intent === "register" ? await provider.register(host) : await provider.status(host);
        const ready = readyToActivate(status);
        await withUser(user.id, (db) => db`select public.set_domain_verification(${domainId}, ${ready}, ${db.json(status as unknown as never)})`);
        message = ready
          ? `${host} is verified by ${status.provider} and its DNS points at the project. You can activate it.`
          : !status.registered
            ? `${host} is not registered on the hosting project yet.`
            : !status.verified
              ? `${host} is registered but not verified yet. Add the verification record shown below at your DNS provider, then check again.`
              : `${host} is verified, but the provider reports its DNS as not configured yet. Add the recommended record and check again.`;
        break;
      }
      case "activate":
        await withUser(user.id, (db) => db`select public.activate_domain(${domainId})`);
        message = `${host} is active. It is served as soon as the site is in live mode.`;
        break;
      case "disable":
        await withUser(user.id, (db) => db`select public.disable_domain(${domainId})`);
        message = `${host} is disabled and no longer served.`;
        break;
      case "canonical":
        await withUser(user.id, (db) => db`select public.set_canonical_domain(${domainId})`);
        message = `${host} is the canonical domain; other active domains redirect to it.`;
        break;
      case "remove": {
        const provider = getDomainProvider();
        if (provider && found.status !== "pending") await provider.remove(host);
        await withUser(user.id, (db) => db`select public.remove_domain(${domainId})`);
        message = `${host} was removed.`;
        break;
      }
    }
    revalidatePath(`/app/sites/${siteId}/settings`);
    revalidatePath(`/app/sites/${siteId}`);
    return { message };
  } catch (err) {
    return fail(err);
  }
}

export interface SiteModeState {
  message?: string;
  error?: string;
}

/** Owner-only switch between demonstration and live mode, guarded by set_site_mode. */
export async function setSiteModeAction(_prev: SiteModeState, formData: FormData): Promise<SiteModeState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const mode = String(formData.get("mode") ?? "");
  if (!uuid.safeParse(siteId).success || (mode !== "live" && mode !== "demo")) return { error: "Invalid request." };
  try {
    await withUser(user.id, (db) => db`select public.set_site_mode(${siteId}, ${mode}::public.site_mode)`);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/app/sites/${siteId}/settings`);
  revalidatePath(`/app/sites/${siteId}`);
  return { message: mode === "live" ? "The site is live: its active canonical domain now serves the current release, and the demonstration route no longer does." : "The site is back in demonstration mode: domains stop serving it and the demonstration route serves it again." };
}

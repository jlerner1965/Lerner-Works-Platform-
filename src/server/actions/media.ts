"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";

export interface MediaActionState {
  message?: string;
  error?: string;
}

const uuid = z.uuid();

export async function updateMediaAction(_prev: MediaActionState, formData: FormData): Promise<MediaActionState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(assetId).success) return { error: "Invalid request." };
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return { error: "Source URL must start with http:// or https://." };
  try {
    const res = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canEdit) return 0;
      const r = await db`update public.media_assets set
          title = ${String(formData.get("title") ?? "").trim().slice(0, 200) || null},
          alt_text = ${String(formData.get("altText") ?? "").trim().slice(0, 500) || null},
          decorative = ${formData.get("decorative") === "on"},
          attribution_text = ${String(formData.get("attributionText") ?? "").trim().slice(0, 500) || null},
          license = ${String(formData.get("license") ?? "").trim().slice(0, 200) || null},
          source_url = ${sourceUrl.slice(0, 1000) || null}
        where id = ${assetId} and site_id = ${siteId} and status <> 'withdrawn'`;
      return r.count;
    });
    if (res !== 1) return { error: "The asset could not be updated." };
    revalidatePath(`/app/sites/${siteId}/media/${assetId}`);
    return { message: "Metadata saved." };
  } catch (err) {
    return { error: describeDbError(err).message };
  }
}

export interface AltTextBatchState {
  message?: string;
  error?: string;
  /** Assets that could not be saved, with the reason (the rest were). */
  failed?: Array<{ assetId: string; reason: string }>;
}

/**
 * Saves alternative text (or the decorative flag) for many assets at once: the pass after a
 * multi-file upload (site-building programme B2-3, SB-05). Each asset needs alternative text
 * unless it is marked decorative; nothing else is touched. Assets of another site are ignored
 * by row-level security and reported as not saved.
 */
export async function updateAltTextBatchAction(_prev: AltTextBatchState, formData: FormData): Promise<AltTextBatchState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  if (!uuid.safeParse(siteId).success) return { error: "Invalid request." };
  const assetIds = formData.getAll("assetId").map(String).filter((id) => uuid.safeParse(id).success);
  if (assetIds.length === 0) return { error: "No images to save." };
  if (assetIds.length > 100) return { error: "Save at most 100 images at a time." };
  const failed: AltTextBatchState["failed"] = [];
  const entries = assetIds.map((assetId) => ({ assetId, altText: String(formData.get(`alt_${assetId}`) ?? "").trim().slice(0, 500), decorative: formData.get(`decorative_${assetId}`) === "on" }));
  for (const e of entries) if (!e.decorative && !e.altText) failed.push({ assetId: e.assetId, reason: "Enter alternative text or mark the image decorative." });
  const valid = entries.filter((e) => !failed.some((f) => f.assetId === e.assetId));
  let saved = 0;
  try {
    saved = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canEdit) throw new Error("You do not have edit access to this site.");
      let n = 0;
      for (const e of valid) {
        const r = await db`update public.media_assets set alt_text = ${e.decorative ? null : e.altText}, decorative = ${e.decorative}
          where id = ${e.assetId} and site_id = ${siteId} and status <> 'withdrawn'`;
        if (r.count === 1) n++;
        else failed.push({ assetId: e.assetId, reason: "The image could not be updated." });
      }
      return n;
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : describeDbError(err).message };
  }
  revalidatePath(`/app/sites/${siteId}/media`);
  return { message: `Saved alternative text for ${saved} image${saved === 1 ? "" : "s"}.${failed.length ? ` ${failed.length} still need attention.` : ""}`, failed };
}

/**
 * Sets or clears an asset's focal point (0–1 from the left and the top). Called directly from
 * the media library's focal point editor; the next candidate freezes the value with the asset.
 */
export async function setFocalPointAction(input: { siteId: string; assetId: string; focal: { x: number; y: number } | null }): Promise<MediaActionState> {
  const user = await requireUser();
  if (!uuid.safeParse(input.siteId).success || !uuid.safeParse(input.assetId).success) return { error: "Invalid request." };
  const focal = input.focal;
  if (focal && !(Number.isFinite(focal.x) && Number.isFinite(focal.y) && focal.x >= 0 && focal.x <= 1 && focal.y >= 0 && focal.y <= 1)) return { error: "The focal point must lie inside the image." };
  const x = focal ? Math.round(focal.x * 1000) / 1000 : null;
  const y = focal ? Math.round(focal.y * 1000) / 1000 : null;
  try {
    const res = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, input.siteId);
      if (!ctx?.capabilities.canEdit) return 0;
      const r = await db`update public.media_assets set focal_x = ${x}, focal_y = ${y}
        where id = ${input.assetId} and site_id = ${input.siteId} and status <> 'withdrawn'`;
      return r.count;
    });
    if (res !== 1) return { error: "The focal point could not be saved." };
    revalidatePath(`/app/sites/${input.siteId}/media/${input.assetId}`);
    return { message: focal ? `Focal point saved at ${Math.round(focal.x * 100)}% across, ${Math.round(focal.y * 100)}% down. It applies to the next release.` : "Focal point cleared; crops centre the image again." };
  } catch (err) {
    return { error: describeDbError(err).message };
  }
}

export async function withdrawMediaAction(_prev: MediaActionState, formData: FormData): Promise<MediaActionState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(assetId).success) return { error: "Invalid request." };
  try {
    await withUser(user.id, (db) => db`select public.withdraw_media_asset(${assetId}, ${reason})`);
    revalidatePath(`/app/sites/${siteId}/media/${assetId}`);
    return { message: "Asset withdrawn. Releases containing it can no longer be restored." };
  } catch (err) {
    const d = describeDbError(err);
    return { error: d.code === "forbidden" ? "Only organization owners can withdraw assets." : d.message };
  }
}

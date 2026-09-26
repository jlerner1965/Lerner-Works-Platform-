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

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { buildCandidate, discardCandidate, waiveWarning } from "@/server/publishing/candidates";
import { activateCandidate, restoreRelease, type ActivationResult } from "@/server/publishing/activate";

const uuid = z.uuid();

export interface PublishState {
  message?: string;
  error?: string;
  result?: ActivationResult;
}

export async function buildCandidateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  if (!uuid.safeParse(siteId).success) redirect("/app");
  const ctx = await withUser(user.id, (db) => loadSiteContext(db, siteId));
  if (!ctx?.capabilities.canPublish) redirect(`/app/sites/${siteId}/publishing?error=forbidden`);
  let candidateId: string;
  try {
    const { candidate } = await buildCandidate(user.id, ctx.site);
    candidateId = candidate.id;
  } catch (err) {
    redirect(`/app/sites/${siteId}/publishing?error=${encodeURIComponent(describeDbError(err).message.slice(0, 200))}`);
  }
  revalidatePath(`/app/sites/${siteId}/publishing`);
  redirect(`/app/sites/${siteId}/publishing/candidates/${candidateId}`);
}

export async function activateCandidateAction(_prev: PublishState, formData: FormData): Promise<PublishState> {
  const user = await requireUser();
  const candidateId = String(formData.get("candidateId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;
  if (!uuid.safeParse(candidateId).success || !uuid.safeParse(siteId).success || idempotencyKey.length < 8) return { error: "Invalid request." };
  const ctx = await withUser(user.id, (db) => loadSiteContext(db, siteId));
  if (!ctx?.capabilities.canPublish) return { error: "You do not have permission to publish this site." };
  const result = await activateCandidate(user.id, candidateId, idempotencyKey, reason);
  revalidatePath(`/app/sites/${siteId}/publishing`);
  revalidatePath(`/app/sites/${siteId}/publishing/candidates/${candidateId}`);
  revalidatePath(`/app/sites/${siteId}`);
  if (result.outcome === "activated" || result.outcome === "already_activated") {
    return { result, message: result.outcome === "activated" ? "Release activated." : "This candidate had already been activated; no second release was created." };
  }
  const failure = result as Exclude<ActivationResult, { outcome: "activated" | "already_activated" }>;
  return { result, error: failure.message };
}

export async function discardCandidateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const candidateId = String(formData.get("candidateId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  if (uuid.safeParse(candidateId).success) await discardCandidate(user.id, candidateId);
  revalidatePath(`/app/sites/${siteId}/publishing`);
  redirect(`/app/sites/${siteId}/publishing`);
}

export interface WaiveState {
  error?: string;
  message?: string;
}

export async function waiveWarningAction(_prev: WaiveState, formData: FormData): Promise<WaiveState> {
  const user = await requireUser();
  const candidateId = String(formData.get("candidateId") ?? "");
  const code = String(formData.get("code") ?? "");
  const itemId = String(formData.get("itemId") ?? "") || undefined;
  const field = String(formData.get("field") ?? "") || undefined;
  const reason = String(formData.get("reason") ?? "");
  if (!uuid.safeParse(candidateId).success) return { error: "Invalid request." };
  const res = await waiveWarning(user.id, candidateId, { code, itemId, field }, reason);
  if (!res.ok) return { error: res.message };
  revalidatePath(`/app/sites/*/publishing/candidates/${candidateId}`);
  return { message: "Warning waived; the reason is stored with the release." };
}

export interface RestoreState {
  error?: string;
  message?: string;
  releaseId?: string;
}

export async function restoreReleaseAction(_prev: RestoreState, formData: FormData): Promise<RestoreState> {
  const user = await requireUser();
  const releaseId = String(formData.get("releaseId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!uuid.safeParse(releaseId).success || !uuid.safeParse(siteId).success || idempotencyKey.length < 8) return { error: "Invalid request." };
  if (reason.length < 3) return { error: "Enter a reason for restoring this release." };
  const ctx = await withUser(user.id, (db) => loadSiteContext(db, siteId));
  if (!ctx?.capabilities.canPublish) return { error: "You do not have permission to restore releases for this site." };
  const result = await restoreRelease(user.id, releaseId, idempotencyKey, reason);
  revalidatePath(`/app/sites/${siteId}/publishing`);
  revalidatePath(`/app/sites/${siteId}`);
  if (result.outcome === "error") return { error: result.message };
  return { message: result.outcome === "restored" ? "Release restored as a new release." : result.outcome === "already_active" ? "That release is already active." : "This restore had already been applied.", releaseId: result.releaseId };
}

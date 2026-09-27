"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { describeDbError } from "@/server/data/db";
import { deleteOrganization, deleteSite } from "@/server/data/removal";

export interface RemovalState {
  error?: string;
}

const uuid = z.uuid();

function explain(err: unknown, subject: "site" | "organization"): RemovalState {
  const e = describeDbError(err);
  if (e.code === "forbidden") return { error: `Only organization owners can delete ${subject === "site" ? "a site" : "an organization"}.` };
  if (e.code === "not_found") return { error: `The ${subject} no longer exists.` };
  return { error: e.message.charAt(0).toUpperCase() + e.message.slice(1) + "." };
}

/** Deletes a site after the owner typed its key; the rules are checked by public.delete_site. */
export async function deleteSiteAction(_prev: RemovalState, formData: FormData): Promise<RemovalState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const confirmKey = String(formData.get("confirmKey") ?? "").trim();
  if (!uuid.safeParse(siteId).success) return { error: "Invalid request." };
  if (!confirmKey) return { error: "Type the site key to confirm the deletion." };
  let name: string;
  let leftovers = 0;
  try {
    const result = await deleteSite(user.id, siteId, confirmKey);
    name = result.name;
    leftovers = result.storage.leftovers.length;
  } catch (err) {
    return explain(err, "site");
  }
  redirect(`/app?removed=site&name=${encodeURIComponent(name)}${leftovers ? `&leftovers=${leftovers}` : ""}`);
}

/** Deletes an organization, its sites first, after the owner typed its name; the rules are checked by public.delete_organization before anything goes. */
export async function deleteOrganizationAction(_prev: RemovalState, formData: FormData): Promise<RemovalState> {
  const user = await requireUser();
  const organizationId = String(formData.get("organizationId") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "").trim();
  if (!uuid.safeParse(organizationId).success) return { error: "Invalid request." };
  if (!confirmName) return { error: "Type the organization name to confirm the deletion." };
  let name: string;
  let leftovers = 0;
  try {
    const result = await deleteOrganization(user.id, organizationId, confirmName);
    name = result.name;
    leftovers = result.sites.reduce((n, s) => n + s.storage.leftovers.length, 0);
  } catch (err) {
    return explain(err, "organization");
  }
  redirect(`/app?removed=organization&name=${encodeURIComponent(name)}${leftovers ? `&leftovers=${leftovers}` : ""}`);
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { createSiteFromPreset } from "@/server/data/sites";
import { isPresetKey, presets } from "@/modules/presets";
import { slugify } from "@/lib/slug";
import { ianaTimeZoneSchema } from "@/modules/common";

export interface CreateSiteState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

const schema = z.object({
  organizationId: z.uuid().or(z.literal("new")),
  newOrganizationName: z.string().trim().max(120).default(""),
  preset: z.string().refine(isPresetKey, "Choose a preset."),
  name: z.string().trim().min(1, "Enter a site name.").max(120),
  key: z.string().trim().min(1, "Enter an internal key.").max(60),
  timeZone: ianaTimeZoneSchema,
  mode: z.enum(["demo", "live"]).default("demo"),
  contactEmail: z.union([z.literal(""), z.email("Enter a valid email address.")]).default(""),
  contactPhone: z.string().trim().max(40).default(""),
  contactAddress: z.string().trim().max(300).default(""),
  inquiryRecipients: z.string().trim().max(500).default(""),
});

export async function createSiteAction(_prev: CreateSiteState, formData: FormData): Promise<CreateSiteState> {
  const user = await requireUser();
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, values };
  }
  const d = parsed.data;
  const key = slugify(d.key);
  if (!key) return { fieldErrors: { key: "Use lowercase letters, numbers and hyphens." }, values };
  const recipients = d.inquiryRecipients.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  for (const r of recipients) if (!z.email().safeParse(r).success) return { fieldErrors: { inquiryRecipients: `"${r}" is not a valid email address.` }, values };
  let organizationId = d.organizationId;
  let siteId: string;
  try {
    if (organizationId === "new") {
      if (!d.newOrganizationName) return { fieldErrors: { newOrganizationName: "Enter the new organization's name." }, values };
      const rows = await withUser(user.id, (db) => db<{ id: string }[]>`select public.create_organization(${d.newOrganizationName}) as id`);
      organizationId = rows[0]!.id;
    }
    const result = await createSiteFromPreset(user.id, {
      organizationId,
      key,
      name: d.name,
      preset: d.preset as keyof typeof presets,
      timeZone: d.timeZone,
      mode: d.mode,
      contact: { email: d.contactEmail, phone: d.contactPhone, address: d.contactAddress, inquiryRecipients: recipients },
    });
    siteId = result.siteId;
  } catch (err) {
    const e = describeDbError(err);
    if (e.code === "conflict") return { fieldErrors: { key: "This key is already in use by another site." }, values };
    if (e.code === "forbidden") return { error: "Only organization owners can create sites.", values };
    return { error: e.message, values };
  }
  redirect(`/app/sites/${siteId}?created=1`);
}

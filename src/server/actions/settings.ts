"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { getCurrentSiteConfig, saveSiteConfig } from "@/server/data/sites";
import { siteConfigSchema, footerVariants, typographyPresetKeys, headerStyles, heroStyles, cardStyles, radiusScales, densities, containerWidths, tokenOverrideKeys, type SiteConfig, type IndexModuleKey } from "@/modules/site-config";
import { normalizeHost } from "@/server/publishing/public-site";
import { designCapabilityIssues, themeKeyForPreset } from "@/themes/capabilities";

export interface SettingsState {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const uuid = z.uuid();

type Patch = (config: SiteConfig, form: FormData, preset: "community_guide" | "location_business") => SiteConfig;

async function saveConfigSection(formData: FormData, section: string, patch: Patch, opts: { design?: boolean } = {}): Promise<SettingsState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const baseRevisionId = String(formData.get("baseRevisionId") ?? "");
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(baseRevisionId).success) return { error: "Invalid request." };
  try {
    return await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canManageSettings) return { error: "You do not have permission to change settings for this site." };
      if (opts.design && !ctx.capabilities.canDesign) return { error: "Only organization owners change the design of a site." };
      const current = await getCurrentSiteConfig(db, siteId);
      if (!current) return { error: "The site has no configuration revision." };
      let next: SiteConfig;
      try {
        next = siteConfigSchema.parse(patch(structuredClone(current.config), formData, ctx.site.preset));
      } catch (err) {
        if (err instanceof z.ZodError) {
          const fieldErrors: Record<string, string> = {};
          for (const i of err.issues) fieldErrors[i.path.join(".")] ??= i.message;
          return { error: "Some fields need attention.", fieldErrors };
        }
        throw err;
      }
      const designIssues = designCapabilityIssues(themeKeyForPreset(ctx.site.preset), next.design);
      if (designIssues.length) return { error: "Some design choices are not offered by this site's theme.", fieldErrors: Object.fromEntries(designIssues.map((i) => [i.path, i.message])) };
      const result = await saveSiteConfig(db, { siteId, organizationId: ctx.site.organizationId, baseRevisionId, config: next, authorId: user.id, changeNote: `Updated ${section}` });
      if (!result.ok) return { error: "Settings changed elsewhere while you were editing. Reload the page and apply your change again." };
      if (opts.design) {
        await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata)
          values (${ctx.site.organizationId}, ${siteId}, ${user.id}, 'design.updated', 'site_config_revision', ${result.revision.id}, ${db.json({ design: next.design })})`;
      }
      revalidatePath(`/app/sites/${siteId}/settings`);
      return { message: `${section} saved as configuration revision ${result.revision.version}. Publish a release to make it public.` };
    });
  } catch (err) {
    return { error: describeDbError(err).message };
  }
}

function pick<T extends string>(form: FormData, name: string, allowed: readonly T[], fallback: T): T {
  const value = String(form.get(name) ?? "");
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Site-wide design options (owners only; every change is audited). */
export async function saveDesignAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  return saveConfigSection(
    formData,
    "Design",
    (config, form) => {
      const overrides = { ...config.design.overrides };
      for (const key of tokenOverrideKeys) overrides[key] = String(form.get(`override_${key}`) ?? "").trim().toLowerCase();
      config.design = {
        header: pick(form, "header", headerStyles, "default"),
        hero: pick(form, "hero", heroStyles, "default"),
        cards: pick(form, "cards", cardStyles, "default"),
        radius: pick(form, "radius", radiusScales, "none"),
        density: pick(form, "density", densities, "regular"),
        container: pick(form, "container", containerWidths, "regular"),
        overrides,
      };
      return config;
    },
    { design: true },
  );
}

/** A media asset id from a select, or null for "none". Asset ownership is enforced when the release is built. */
function assetId(form: FormData, name: string): string | null {
  const value = String(form.get(name) ?? "");
  return uuid.safeParse(value).success ? value : null;
}

export async function saveBrandingAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  return saveConfigSection(formData, "Branding", (config, form) => {
    const typography = String(form.get("typography") ?? "");
    config.branding = {
      ...config.branding,
      wordmark: String(form.get("wordmark") ?? "").trim(),
      tagline: String(form.get("tagline") ?? "").trim(),
      logoAssetId: assetId(form, "logoAssetId"),
      colors: {
        primary: String(form.get("primary") ?? "").trim(),
        accent: String(form.get("accent") ?? "").trim(),
        background: String(form.get("background") ?? "").trim(),
        text: String(form.get("text") ?? "").trim(),
      },
      typography: (typographyPresetKeys as readonly string[]).includes(typography) ? (typography as SiteConfig["branding"]["typography"]) : "editorial-serif",
    };
    return config;
  });
}

function readLinks(form: FormData, prefix: string): Array<{ label: string; path: string }> {
  const out: Array<{ label: string; path: string }> = [];
  for (let i = 0; i < 8; i++) {
    const label = String(form.get(`${prefix}Label${i}`) ?? "").trim();
    const path = String(form.get(`${prefix}Path${i}`) ?? "").trim();
    if (label || path) out.push({ label, path });
  }
  return out;
}

export async function saveNavigationAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  return saveConfigSection(formData, "Navigation and footer", (config, form) => {
    const variant = String(form.get("footerVariant") ?? "");
    config.navigation = { items: readLinks(form, "nav"), showSearch: form.get("showSearch") === "on" };
    config.footer = {
      text: String(form.get("footerText") ?? "").trim(),
      links: readLinks(form, "footer"),
      showContactDetails: form.get("showContactDetails") === "on",
      variant: (footerVariants as readonly string[]).includes(variant) ? (variant as SiteConfig["footer"]["variant"]) : "columns",
    };
    return config;
  });
}

export async function saveModulesAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  return saveConfigSection(formData, "Modules", (config, form) => {
    config.modules = {
      places: form.get("places") === "on",
      events: form.get("events") === "on",
      articles: form.get("articles") === "on",
      stores: form.get("stores") === "on",
      services: form.get("services") === "on",
      inquiries: form.get("inquiries") === "on",
    };
    return config;
  });
}

const indexModules: IndexModuleKey[] = ["places", "events", "articles", "stores", "services"];

export async function saveIndexesAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  return saveConfigSection(formData, "Listing pages", (config, form) => {
    for (const m of indexModules) {
      config.indexes[m] = {
        title: String(form.get(`${m}Title`) ?? "").trim(),
        intro: String(form.get(`${m}Intro`) ?? "").trim(),
      };
    }
    return config;
  });
}

export async function saveMetadataAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  return saveConfigSection(formData, "Site metadata", (config, form) => {
    config.metadata = {
      defaultTitle: String(form.get("defaultTitle") ?? "").trim(),
      titleSuffix: String(form.get("titleSuffix") ?? "").trim(),
      defaultDescription: String(form.get("defaultDescription") ?? "").trim(),
      language: String(form.get("language") ?? "").trim() || "en",
      faviconAssetId: assetId(form, "faviconAssetId"),
      shareImageAssetId: assetId(form, "shareImageAssetId"),
    };
    return config;
  });
}

export async function saveContactAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  if (!uuid.safeParse(siteId).success) return { error: "Invalid request." };
  const email = String(formData.get("contactEmail") ?? "").trim();
  if (email && !z.email().safeParse(email).success) return { error: "Contact email is not valid.", fieldErrors: { contactEmail: "Enter a valid email address." } };
  const recipients = String(formData.get("inquiryRecipients") ?? "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  for (const r of recipients) if (!z.email().safeParse(r).success) return { error: `"${r}" is not a valid email address.`, fieldErrors: { inquiryRecipients: `"${r}" is not a valid email address.` } };
  try {
    const ok = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canManageSettings) return false;
      const r = await db`update public.sites set
        name = ${String(formData.get("name") ?? "").trim().slice(0, 120) || ctx.site.name},
        time_zone = ${String(formData.get("timeZone") ?? "").trim() || ctx.site.timeZone},
        contact_email = ${email || null}, contact_phone = ${String(formData.get("contactPhone") ?? "").trim().slice(0, 40) || null},
        contact_address = ${String(formData.get("contactAddress") ?? "").trim().slice(0, 300) || null},
        inquiry_recipients = ${recipients}
        where id = ${siteId}`;
      await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata)
        values (${ctx.site.organizationId}, ${siteId}, ${user.id}, 'site.contact_updated', 'site', ${siteId}, ${db.json({ recipients: recipients.length })})`;
      return r.count === 1;
    });
    if (!ok) return { error: "You do not have permission to change settings for this site." };
    revalidatePath(`/app/sites/${siteId}/settings`);
    revalidatePath(`/app/sites/${siteId}`);
    return { message: "Contact defaults saved. Site identity and contact details apply to the next release." };
  } catch (err) {
    const d = describeDbError(err);
    return { error: d.code === "invalid" ? "Time zone must be a valid IANA name." : d.message };
  }
}

export async function addDomainAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const host = normalizeHost(String(formData.get("host") ?? ""));
  if (!uuid.safeParse(siteId).success) return { error: "Invalid request." };
  if (!host || !host.includes(".")) return { error: "Enter a valid hostname such as www.example.com.", fieldErrors: { host: "Enter a valid hostname." } };
  try {
    const ok = await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.isOwner) return false;
      await db`insert into public.domains (organization_id, site_id, normalized_host, is_canonical, created_by)
        values (${ctx.site.organizationId}, ${siteId}, ${host}, ${formData.get("canonical") === "on"}, ${user.id})`;
      await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata)
        values (${ctx.site.organizationId}, ${siteId}, ${user.id}, 'domain.added', 'domain', null, ${db.json({ host })})`;
      return true;
    });
    if (!ok) return { error: "Only organization owners can register domains." };
    revalidatePath(`/app/sites/${siteId}/settings`);
    return { message: `${host} registered with status "pending". Next: register it with the hosting provider and add the records the provider asks for; nothing is marked verified without the provider's confirmation.` };
  } catch (err) {
    const d = describeDbError(err);
    return { error: d.code === "conflict" ? "That hostname is already registered." : d.message };
  }
}

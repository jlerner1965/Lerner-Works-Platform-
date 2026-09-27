"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withUser, describeDbError } from "@/server/data/db";
import { loadSiteContext } from "@/server/data/access";
import { getCurrentSiteConfig, saveSiteConfig } from "@/server/data/sites";
import { siteConfigSchema, footerVariants, typographyPresetKeys, headerStyles, heroStyles, cardStyles, radiusScales, densities, containerWidths, tokenOverrideKeys, themeKeys, type SiteConfig, type IndexModuleKey } from "@/modules/site-config";
import { normalizeHost } from "@/server/publishing/public-site";
import { capabilitiesFor, designCapabilityIssues, sectionCapabilityIssues, themeCompatibilityIssues, themeKeyFor } from "@/themes/capabilities";
import type { Db } from "@/server/data/db";
import type { SiteContext } from "@/server/data/access";

export interface SettingsState {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Things the owner should know after a successful save (for example what a theme change leaves unsupported). */
  notes?: string[];
}

const uuid = z.uuid();

type Patch = (config: SiteConfig, form: FormData, preset: "community_guide" | "location_business") => SiteConfig;
/** Runs after a successful save, inside the same transaction; returns notes for the owner. */
type AfterSave = (db: Db, ctx: SiteContext, previous: SiteConfig, next: SiteConfig) => Promise<string[]>;

async function saveConfigSection(formData: FormData, section: string, patch: Patch, opts: { design?: boolean; afterSave?: AfterSave } = {}): Promise<SettingsState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  const baseRevisionId = String(formData.get("baseRevisionId") ?? "");
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(baseRevisionId).success) return { error: "Invalid request." };
  try {
    return await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.canManageSettings) return { error: "You do not have permission to change settings for this site." };
      if (opts.design && !ctx.capabilities.canDesign) return { error: "Design changes need an organization owner, or design delegated to this site's publishers." };
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
      const designIssues = [...themeCompatibilityIssues(ctx.site.preset, next.design), ...designCapabilityIssues(themeKeyFor(ctx.site.preset, next.design), next.design)];
      if (designIssues.length) return { error: "Some design choices are not offered by this site's theme.", fieldErrors: Object.fromEntries(designIssues.map((i) => [i.path, i.message])) };
      const result = await saveSiteConfig(db, { siteId, organizationId: ctx.site.organizationId, baseRevisionId, config: next, authorId: user.id, changeNote: `Updated ${section}` });
      if (!result.ok) return { error: "Settings changed elsewhere while you were editing. Reload the page and apply your change again." };
      if (opts.design) {
        await db`insert into public.audit_events (organization_id, site_id, actor_id, action, entity_type, entity_id, metadata)
          values (${ctx.site.organizationId}, ${siteId}, ${user.id}, 'design.updated', 'site_config_revision', ${result.revision.id}, ${db.json({ design: next.design })})`;
      }
      const notes = opts.afterSave ? await opts.afterSave(db, ctx, current.config, next) : [];
      revalidatePath(`/app/sites/${siteId}/settings`);
      return { message: `${section} saved as configuration revision ${result.revision.version}. Publish a release to make it public.`, ...(notes.length ? { notes } : {}) };
    });
  } catch (err) {
    return { error: describeDbError(err).message };
  }
}

function pick<T extends string>(form: FormData, name: string, allowed: readonly T[], fallback: T): T {
  const value = String(form.get(name) ?? "");
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Site-wide design options (owners only; every change is audited). A theme change keeps
 * composition choices the new theme offers, resets the others to the theme default and says
 * so, and lists the pages whose sections the new theme does not render: they block
 * publication until changed (D2).
 */
export async function saveDesignAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const notes: string[] = [];
  const state = await saveConfigSection(
    formData,
    "Design",
    (config, form, preset) => {
      const overrides = { ...config.design.overrides };
      for (const key of tokenOverrideKeys) overrides[key] = String(form.get(`override_${key}`) ?? "").trim().toLowerCase();
      const theme = pick(form, "theme", ["default", ...themeKeys] as const, "default");
      const caps = capabilitiesFor(preset, { theme });
      const keepOrReset = <T extends string>(field: "header" | "hero" | "cards", value: T, offered: readonly string[], label: string): T | "default" => {
        if (value === "default" || offered.includes(value)) return value;
        notes.push(`${label} was set to the theme default because the ${caps.label} theme does not offer "${value}".`);
        return "default";
      };
      config.design = {
        theme,
        header: keepOrReset("header", pick(form, "header", headerStyles, "default"), caps.header, "Header layout"),
        hero: keepOrReset("hero", pick(form, "hero", heroStyles, "default"), caps.hero, "Image hero style"),
        cards: keepOrReset("cards", pick(form, "cards", cardStyles, "default"), caps.cards, "Cards in collections"),
        radius: pick(form, "radius", radiusScales, "none"),
        density: pick(form, "density", densities, "regular"),
        container: pick(form, "container", containerWidths, "regular"),
        overrides,
      };
      return config;
    },
    {
      design: true,
      afterSave: async (db, ctx, previous, next) => {
        const before = themeKeyFor(ctx.site.preset, previous.design);
        const after = themeKeyFor(ctx.site.preset, next.design);
        if (before === after) return [];
        const caps = capabilitiesFor(ctx.site.preset, next.design);
        const pages = await db<Array<{ title: string; sections: Array<{ type: string; variant?: string }> | null }>>`
          select r.title, r.payload->'sections' as sections from public.content_items i join public.content_revisions r on r.id = i.current_revision_id
          where i.site_id = ${ctx.site.id} and i.kind = 'page' and i.archived_at is null order by r.title`;
        const out: string[] = [`Theme changed to ${caps.label}. The public site changes with the next release; use the design preview to look first.`];
        for (const page of pages) {
          for (const issue of sectionCapabilityIssues(after, page.sections ?? [])) out.push(`Page "${page.title}": ${issue.message} Publication is blocked until it is changed.`);
        }
        return out;
      },
    },
  );
  return notes.length ? { ...state, notes: [...(state.notes ?? []), ...notes] } : state;
}

/** Owner-only switch that lets this site's publishers change its design (D-017: off by default; audited by the SQL function). */
export async function setDesignDelegationAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  if (!uuid.safeParse(siteId).success) return { error: "Invalid request." };
  const enabled = formData.get("delegated") === "on";
  try {
    return await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.isOwner) return { error: "Only organization owners delegate design." };
      await db`select public.set_design_delegation(${siteId}, ${enabled})`;
      revalidatePath(`/app/sites/${siteId}/settings`);
      return { message: enabled ? "Design delegated: this site's publishers now see the Design card and may change the design." : "Design delegation switched off: only organization owners change this site's design." };
    });
  } catch (err) {
    return { error: describeDbError(err).message };
  }
}

/** Review policy (B1): owners decide whether every revision needs an explicit approval or publishers' saves count as approved. */
export async function setReviewPolicyAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  if (!uuid.safeParse(siteId).success) return { error: "Invalid request." };
  const required = formData.get("reviewRequired") === "on";
  try {
    return await withUser(user.id, async (db) => {
      const ctx = await loadSiteContext(db, siteId);
      if (!ctx?.capabilities.isOwner) return { error: "Only organization owners change the review policy." };
      await db`select public.set_review_policy(${siteId}, ${required})`;
      revalidatePath(`/app/sites/${siteId}/settings`);
      revalidatePath(`/app/sites/${siteId}`);
      return { message: required ? "Review required: every saved revision now needs an explicit approval before it can publish, including your own." : "Review not required: saves by owners and publishers are approved as they are saved; editors' work still needs a publisher's approval." };
    });
  } catch (err) {
    return { error: describeDbError(err).message };
  }
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
      logoDarkAssetId: assetId(form, "logoDarkAssetId"),
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
    config.navigation = {
      items: readLinks(form, "nav"),
      showSearch: form.get("showSearch") === "on",
      cta: { label: String(form.get("ctaLabel") ?? "").trim(), path: String(form.get("ctaPath") ?? "").trim() },
    };
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
      links: form.get("links") === "on",
    };
    return config;
  });
}

const indexModules: IndexModuleKey[] = ["places", "events", "articles", "stores", "services", "links"];

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

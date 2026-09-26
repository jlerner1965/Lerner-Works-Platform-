import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getCurrentSiteConfig } from "@/server/data/sites";
import { Badge, Card, PageHeader, inputClass, selectClass, formatDateTime } from "@/components/admin/ui";
import { SettingsSection } from "@/components/admin/settings-forms";
import { saveBrandingAction, saveNavigationAction, saveModulesAction, saveMetadataAction, saveContactAction, addDomainAction } from "@/server/actions/settings";
import { contrastRatio, formatRatio } from "@/lib/contrast";
import { moduleIndexRoutes } from "@/modules/registry";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/settings`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canManageSettings) notFound();
  const data = await withUser(user.id, async (db) => {
    const config = await getCurrentSiteConfig(db, siteId);
    const domains = await db<Array<{ id: string; normalizedHost: string; status: string; isCanonical: boolean; verifiedAt: Date | null; createdAt: Date }>>`select id, normalized_host, status::text, is_canonical, verified_at, created_at from public.domains where site_id = ${siteId} order by created_at`;
    const assets = await db<Array<{ id: string; title: string | null }>>`select id, title from public.media_assets where site_id = ${siteId} and status = 'ready' order by created_at desc limit 100`;
    return { config, domains, assets };
  });
  if (!data.config) notFound();
  const { config } = data.config;
  const hidden = { siteId, baseRevisionId: data.config.id };
  const c = config.branding.colors;
  const checks = [
    { label: "Body text on background", ratio: contrastRatio(c.text, c.background) },
    { label: "White text on primary", ratio: contrastRatio("#ffffff", c.primary) },
    { label: "Accent links on background", ratio: contrastRatio(c.accent, c.background) },
  ];
  const site = ctx.site;
  return (
    <>
      <PageHeader eyebrow={ctx.organization.name} title="Settings" description={`Configuration revision ${data.config.version} (saved ${formatDateTime(data.config.createdAt, site.timeZone)}). Every save creates a new immutable configuration revision; the public site changes only when a release includes it.`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Brand">
          <SettingsSection action={saveBrandingAction} hidden={hidden}>
                          <>
                <label className="block">Wordmark<input name="wordmark" defaultValue={config.branding.wordmark} className={inputClass} required maxLength={60} /></label>
                <label className="block">Tagline<input name="tagline" defaultValue={config.branding.tagline} className={inputClass} maxLength={120} /></label>
                <label className="block">Logo image (raster upload; leave empty for the text wordmark)
                  <select name="logoAssetId" defaultValue={config.branding.logoAssetId ?? ""} className={selectClass}>
                    <option value="">Text wordmark</option>
                    {data.assets.map((a) => <option key={a.id} value={a.id}>{a.title || a.id.slice(0, 8)}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["primary", "accent", "background", "text"] as const).map((k) => (
                    <label key={k} className="block capitalize">{k}
                      <span className="flex items-center gap-2"><input type="color" name={k} defaultValue={c[k]} aria-label={`${k} color`} className="h-9 w-12 border border-line-strong" /><code className="text-xs">{c[k]}</code></span>
                      
                    </label>
                  ))}
                </div>
                <label className="block">Typography preset
                  <select name="typography" defaultValue={config.branding.typography} className={selectClass}>
                    <option value="editorial-serif">Editorial serif (guide)</option>
                    <option value="utility-sans">Utility sans (retail)</option>
                  </select>
                </label>
                <div className="rounded border border-line bg-surface-muted p-2 text-xs">
                  <p className="font-medium">Contrast of the saved colors (WCAG 2.2 AA needs 4.5:1)</p>
                  <ul className="mt-1 space-y-0.5">
                    {checks.map((ch) => (
                      <li key={ch.label} className="flex items-center justify-between"><span>{ch.label}</span><span>{formatRatio(ch.ratio)} <Badge tone={ch.ratio >= 4.5 ? "success" : "danger"}>{ch.ratio >= 4.5 ? "pass" : "blocks publishing"}</Badge></span></li>
                    ))}
                  </ul>
                </div>
              </>
          </SettingsSection>
        </Card>
        <Card title="Navigation and footer">
          <SettingsSection action={saveNavigationAction} hidden={hidden}>
                          <>
                <p className="text-xs text-ink-subtle">Known routes: {["/", ...moduleIndexRoutes.filter((m) => config.modules[m.module]).map((m) => m.path), "/search"].join(", ")} plus page slugs. Links to missing routes block publishing.</p>
                <fieldset><legend className="font-medium">Navigation (up to 8)</legend>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="mt-1 grid grid-cols-2 gap-2">
                      <input name={`navLabel${i}`} defaultValue={config.navigation.items[i]?.label ?? ""} placeholder="Label" aria-label={`Navigation label ${i + 1}`} className={inputClass} maxLength={40} />
                      <input name={`navPath${i}`} defaultValue={config.navigation.items[i]?.path ?? ""} placeholder="/path" aria-label={`Navigation path ${i + 1}`} className={inputClass} />
                    </div>
                  ))}
                </fieldset>
                <label className="block">Footer text<textarea name="footerText" defaultValue={config.footer.text} className={`${inputClass} min-h-16`} maxLength={400} /></label>
                <fieldset><legend className="font-medium">Footer links (up to 8)</legend>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="mt-1 grid grid-cols-2 gap-2">
                      <input name={`footerLabel${i}`} defaultValue={config.footer.links[i]?.label ?? ""} placeholder="Label" aria-label={`Footer label ${i + 1}`} className={inputClass} maxLength={40} />
                      <input name={`footerPath${i}`} defaultValue={config.footer.links[i]?.path ?? ""} placeholder="/path" aria-label={`Footer path ${i + 1}`} className={inputClass} />
                    </div>
                  ))}
                </fieldset>
                <label className="flex items-center gap-2"><input type="checkbox" name="showContactDetails" defaultChecked={config.footer.showContactDetails} /> Show contact details in the footer</label>
              </>
          </SettingsSection>
        </Card>
        <Card title="Modules">
          <SettingsSection action={saveModulesAction} hidden={hidden}>
                          <>
                <p className="text-xs text-ink-subtle">Disabling a module removes its routes from the next release. Pages that still depend on it are reported as blockers; nothing is deleted.</p>
                {(["places", "events", "articles", "stores", "services", "inquiries"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 capitalize"><input type="checkbox" name={m} defaultChecked={config.modules[m]} /> {m}</label>
                ))}
              </>
          </SettingsSection>
        </Card>
        <Card title="Site metadata">
          <SettingsSection action={saveMetadataAction} hidden={hidden}>
                          <>
                <label className="block">Default title<input name="defaultTitle" defaultValue={config.metadata.defaultTitle} className={inputClass} required maxLength={70} /></label>
                <label className="block">Title suffix<input name="titleSuffix" defaultValue={config.metadata.titleSuffix} className={inputClass} maxLength={40} /></label>
                <label className="block">Default description<textarea name="defaultDescription" defaultValue={config.metadata.defaultDescription} className={`${inputClass} min-h-16`} maxLength={200} /></label>
              </>
          </SettingsSection>
        </Card>
        <Card title="Identity and contact defaults">
          <SettingsSection action={saveContactAction} hidden={{ siteId }}>
                          <>
                <label className="block">Site name<input name="name" defaultValue={site.name} className={inputClass} required maxLength={120} /></label>
                <label className="block">Time zone (IANA)<input name="timeZone" defaultValue={site.timeZone} className={inputClass} required /></label>
                <label className="block">Contact email<input name="contactEmail" type="email" defaultValue={site.contactEmail ?? ""} className={inputClass} /></label>
                <label className="block">Contact phone<input name="contactPhone" defaultValue={site.contactPhone ?? ""} className={inputClass} maxLength={40} /></label>
                <label className="block">Contact address<input name="contactAddress" defaultValue={site.contactAddress ?? ""} className={inputClass} maxLength={300} /></label>
                <label className="block">Inquiry notification recipients (comma-separated)<input name="inquiryRecipients" defaultValue={site.inquiryRecipients.join(", ")} className={inputClass} /></label>
                <p className="text-xs text-ink-subtle">Recipients are resolved server-side when an inquiry is stored; visitors can never choose them.</p>
              </>
          </SettingsSection>
        </Card>
        <Card title="Domains">
          <p className="mb-2 text-sm text-ink-muted">Mode: <Badge tone={site.mode === "demo" ? "warning" : "success"}>{site.mode}</Badge> {site.mode === "demo" ? `Served at /demo/${site.key}.` : "Served only on active verified domains."}</p>
          {data.domains.length === 0 ? <p className="text-sm text-ink-muted">No domains registered.</p> : (
            <ul className="mb-3 divide-y divide-line text-sm">
              {data.domains.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-1.5">
                  <span><code>{d.normalizedHost}</code>{d.isCanonical ? <Badge tone="info"> canonical</Badge> : null}</span>
                  <Badge tone={d.status === "active" ? "success" : d.status === "disabled" ? "danger" : "warning"}>{d.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          {ctx.capabilities.isOwner ? (
            <SettingsSection action={addDomainAction} hidden={{ siteId }} submitLabel="Register hostname">
              <label className="block">Hostname<input name="host" className={inputClass} placeholder="www.example.com" /></label>
              <label className="flex items-center gap-2"><input type="checkbox" name="canonical" /> Canonical domain (one per site)</label>
              <p className="text-xs text-ink-subtle">Registration records intent only. Ownership verification and activation happen during hosted deployment with the provider&apos;s instructions; no DNS value is inferred here.</p>
            </SettingsSection>
          ) : <p className="text-xs text-ink-subtle">Only organization owners can register domains.</p>}
        </Card>
      </div>
    </>
  );
}

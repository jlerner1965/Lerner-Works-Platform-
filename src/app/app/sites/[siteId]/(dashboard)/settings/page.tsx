import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getCurrentSiteConfig } from "@/server/data/sites";
import { Badge, Card, PageHeader, inputClass, selectClass, formatDateTime } from "@/components/admin/ui";
import { SettingsSection } from "@/components/admin/settings-forms";
import { saveBrandingAction, saveNavigationAction, saveModulesAction, saveIndexesAction, saveMetadataAction, saveDesignAction, saveContactAction, addDomainAction } from "@/server/actions/settings";
import { formatRatio } from "@/lib/contrast";
import { brandPairings } from "@/lib/brand-tokens";
import { moduleIndexRoutes } from "@/modules/registry";
import { tokenOverrideKeys, type IndexModuleKey } from "@/modules/site-config";
import { typographyPresets } from "@/themes/fonts";
import { capabilitiesForPreset } from "@/themes/capabilities";
import { getConfig } from "@/server/config";
import { getDomainProvider, type DomainProviderStatus } from "@/server/domains/provider";
import { DomainRow, SiteModeForm } from "@/components/admin/domain-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/settings`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canManageSettings) notFound();
  const data = await withUser(user.id, async (db) => {
    const config = await getCurrentSiteConfig(db, siteId);
    const domains = await db<Array<{ id: string; normalizedHost: string; status: "pending" | "verifying" | "active" | "disabled"; isCanonical: boolean; verifiedAt: Date | null; createdAt: Date; verificationInstructions: DomainProviderStatus | null }>>`select id, normalized_host, status::text, is_canonical, verified_at, created_at, verification_instructions from public.domains where site_id = ${siteId} order by created_at`;
    const assets = await db<Array<{ id: string; title: string | null; width: number; height: number }>>`select id, title, width, height from public.media_assets where site_id = ${siteId} and status = 'ready' order by created_at desc limit 100`;
    return { config, domains, assets };
  });
  if (!data.config) notFound();
  const { config } = data.config;
  const hidden = { siteId, baseRevisionId: data.config.id };
  const c = config.branding.colors;
  const pairings = brandPairings(c, config.design.overrides);
  const failing = pairings.filter((p) => !p.passes).length;
  const site = ctx.site;
  const theme = capabilitiesForPreset(site.preset);
  const overrideLabels: Record<(typeof tokenOverrideKeys)[number], string> = { surface: "Tinted panels and bands", surfaceStrong: "Stronger tint (placeholders)", muted: "Secondary text", border: "Dividers and card outlines", borderStrong: "Form field borders", focus: "Keyboard focus ring" };
  const cfg = getConfig();
  const providerConfigured = getDomainProvider() !== null;
  const canonical = data.domains.find((d) => d.isCanonical && d.status === "active" && d.verifiedAt);
  const demoUrl = `${cfg.APP_URL}/demo/${site.key}`;
  const liveUrl = canonical ? `https://${canonical.normalizedHost}/` : null;
  const assetLabel = (a: { id: string; title: string | null; width: number; height: number }) => `${a.title || a.id.slice(0, 8)} (${a.width}×${a.height})`;
  const enabledIndexes = moduleIndexRoutes.filter((m) => config.modules[m.module]).map((m) => ({ ...m, module: m.module as IndexModuleKey }));
  return (
    <>
      <PageHeader eyebrow={ctx.organization.name} title="Settings" description={`Configuration revision ${data.config.version} (saved ${formatDateTime(data.config.createdAt, site.timeZone)}). Every save creates a new immutable configuration revision; the public site changes only when a release includes it.`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Brand">
          <SettingsSection action={saveBrandingAction} hidden={hidden}>
            <>
              <label className="block">Wordmark<input name="wordmark" defaultValue={config.branding.wordmark} className={inputClass} required maxLength={60} /></label>
              <label className="block">Tagline<input name="tagline" defaultValue={config.branding.tagline} className={inputClass} maxLength={120} /></label>
              <label className="block">Logo image
                <select name="logoAssetId" defaultValue={config.branding.logoAssetId ?? ""} className={selectClass}>
                  <option value="">Text wordmark (no logo)</option>
                  {data.assets.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
                </select>
              </label>
              <p className="text-xs text-ink-subtle">The logo replaces the wordmark in the header and footer of the public site, shown 40–48 px tall; a wide image (about 3:1) with a transparent background works best. The wordmark stays the logo&apos;s alternative text unless the image has its own.</p>
              <div className="grid grid-cols-2 gap-3">
                {(["primary", "accent", "background", "text"] as const).map((k) => (
                  <label key={k} className="block capitalize">{k}
                    <span className="flex items-center gap-2"><input type="color" name={k} defaultValue={c[k]} aria-label={`${k} color`} className="h-9 w-12 border border-line-strong" /><code className="text-xs">{c[k]}</code></span>
                  </label>
                ))}
              </div>
              <label className="block">Typography preset
                <select name="typography" defaultValue={config.branding.typography} className={selectClass}>
                  {Object.values(typographyPresets).map((t) => <option key={t.key} value={t.key}>{t.label} — {t.description}</option>)}
                </select>
              </label>
              <div className="rounded border border-line bg-surface-muted p-2 text-xs">
                <p className="font-medium">
                  Contrast of the saved colours and the colours derived from them (WCAG 2.2 AA: 4.5:1 for text, 3:1 for focus rings and field borders).{" "}
                  {failing === 0 ? <Badge tone="success">all {pairings.length} pairings pass</Badge> : <Badge tone="danger">{failing} of {pairings.length} pairings block publishing</Badge>}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {pairings.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="inline-flex h-4 w-6 items-center justify-center border border-line text-[10px] font-bold leading-none" style={{ background: p.bg, color: p.fg }}>Aa</span>
                        {p.label}
                      </span>
                      <span className="shrink-0">{formatRatio(p.ratio)} <Badge tone={p.passes ? "success" : "danger"}>{p.passes ? "pass" : `needs ${p.minimum}:1`}</Badge></span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          </SettingsSection>
        </Card>
        {ctx.capabilities.canDesign ? (
          <Card title="Design">
            <SettingsSection action={saveDesignAction} hidden={hidden}>
              <>
                <p className="text-xs text-ink-subtle">Site-wide composition choices offered by the {theme.label} theme. Each page section also has its own style and appearance in the editor; publication checks every choice against the theme. Only organization owners see this card; every save is audited.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">Header layout
                    <select name="header" defaultValue={config.design.header} className={selectClass}>
                      <option value="default">Theme default ({theme.defaults.header})</option>
                      {theme.header.map((h) => <option key={h} value={h}>{h === "left" ? "Brand left, navigation right" : "Brand and navigation centred"}</option>)}
                    </select>
                  </label>
                  <label className="block">Image hero style
                    <select name="hero" defaultValue={config.design.hero} className={selectClass}>
                      <option value="default">Theme default ({theme.defaults.hero})</option>
                      {theme.hero.map((h) => <option key={h} value={h}>{h === "split" ? "Text beside the image" : h === "full" ? "Full-width image with text over it" : "Image above the text"}</option>)}
                    </select>
                  </label>
                  <label className="block">Cards in collections
                    <select name="cards" defaultValue={config.design.cards} className={selectClass}>
                      <option value="default">Theme default ({theme.defaults.cards})</option>
                      {theme.cards.map((s) => <option key={s} value={s}>{s === "image-top" ? "Image above the text" : s === "image-side" ? "Image beside the text" : "Text only"}</option>)}
                    </select>
                  </label>
                  <label className="block">Corner radius
                    <select name="radius" defaultValue={config.design.radius} className={selectClass}>
                      <option value="none">Square corners</option>
                      <option value="small">Small (4 px)</option>
                      <option value="medium">Medium (12 px)</option>
                      <option value="large">Large (24 px)</option>
                    </select>
                  </label>
                  <label className="block">Spacing
                    <select name="density" defaultValue={config.design.density} className={selectClass}>
                      <option value="compact">Compact</option>
                      <option value="regular">Regular</option>
                      <option value="spacious">Spacious</option>
                    </select>
                  </label>
                  <label className="block">Page width
                    <select name="container" defaultValue={config.design.container} className={selectClass}>
                      <option value="narrow">Narrow (56 rem)</option>
                      <option value="regular">Regular (72 rem)</option>
                      <option value="wide">Wide (88 rem)</option>
                    </select>
                  </label>
                </div>
                <fieldset className="rounded border border-line p-2">
                  <legend className="px-1 font-medium">Derived colour overrides</legend>
                  <p className="mb-2 text-xs text-ink-subtle">The platform derives these from the four brand colours (`docs/DESIGN-TOKENS.md`). Enter a 6-digit hex colour to replace one, or leave it empty to keep the derived value; the contrast list in the Brand card checks the result.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {tokenOverrideKeys.map((k) => (
                      <label key={k} className="block">{overrideLabels[k]}
                        <input name={`override_${k}`} defaultValue={config.design.overrides[k]} placeholder="derived" className={inputClass} maxLength={7} pattern="#[0-9a-fA-F]{6}" />
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            </SettingsSection>
          </Card>
        ) : null}
        <Card title="Navigation and footer">
          <SettingsSection action={saveNavigationAction} hidden={hidden}>
            <>
              <p className="text-xs text-ink-subtle">Known routes: {["/", ...enabledIndexes.map((m) => m.path), "/search"].join(", ")} plus page slugs. Links to missing routes block publishing; a full https:// address makes an external link (opened without a referrer).</p>
              <fieldset><legend className="font-medium">Navigation (up to 8)</legend>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="mt-1 grid grid-cols-2 gap-2">
                    <input name={`navLabel${i}`} defaultValue={config.navigation.items[i]?.label ?? ""} placeholder="Label" aria-label={`Navigation label ${i + 1}`} className={inputClass} maxLength={40} />
                    <input name={`navPath${i}`} defaultValue={config.navigation.items[i]?.path ?? ""} placeholder="/path or https://…" aria-label={`Navigation path ${i + 1}`} className={inputClass} />
                  </div>
                ))}
              </fieldset>
              <label className="flex items-center gap-2"><input type="checkbox" name="showSearch" defaultChecked={config.navigation.showSearch} /> Show a Search link in the navigation (the /search page stays reachable by address)</label>
              <label className="block">Footer text<textarea name="footerText" defaultValue={config.footer.text} className={`${inputClass} min-h-16`} maxLength={400} /></label>
              <fieldset><legend className="font-medium">Footer links (up to 8)</legend>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="mt-1 grid grid-cols-2 gap-2">
                    <input name={`footerLabel${i}`} defaultValue={config.footer.links[i]?.label ?? ""} placeholder="Label" aria-label={`Footer label ${i + 1}`} className={inputClass} maxLength={40} />
                    <input name={`footerPath${i}`} defaultValue={config.footer.links[i]?.path ?? ""} placeholder="/path or https://…" aria-label={`Footer path ${i + 1}`} className={inputClass} />
                  </div>
                ))}
              </fieldset>
              <label className="block">Footer layout
                <select name="footerVariant" defaultValue={config.footer.variant} className={selectClass}>
                  <option value="columns">Columns — brand, contact details and links in three columns</option>
                  <option value="compact">Compact — one row with inline links</option>
                </select>
              </label>
              <label className="flex items-center gap-2"><input type="checkbox" name="showContactDetails" defaultChecked={config.footer.showContactDetails} /> Show contact details in the footer</label>
            </>
          </SettingsSection>
        </Card>
        <Card title="Modules">
          <SettingsSection action={saveModulesAction} hidden={hidden}>
            <>
              <p className="text-xs text-ink-subtle">Disabling a module removes its routes from the next release. Pages that still depend on it are reported as blockers; nothing is deleted. With Inquiries off, the published site rejects form submissions and store pages show no form.</p>
              {(["places", "events", "articles", "stores", "services", "inquiries"] as const).map((m) => (
                <label key={m} className="flex items-center gap-2 capitalize"><input type="checkbox" name={m} defaultChecked={config.modules[m]} /> {m}</label>
              ))}
            </>
          </SettingsSection>
        </Card>
        <Card title="Listing pages">
          <SettingsSection action={saveIndexesAction} hidden={hidden}>
            <>
              <p className="text-xs text-ink-subtle">Title and introduction of each module&apos;s listing page. Leave a field empty to keep the theme&apos;s default text.</p>
              {enabledIndexes.length === 0 ? <p className="text-sm text-ink-muted">No content module is enabled.</p> : null}
              {enabledIndexes.map((m) => (
                <fieldset key={m.module} className="rounded border border-line p-2">
                  <legend className="px-1 font-medium">{m.label} <span className="font-normal text-ink-subtle">({m.path})</span></legend>
                  <label className="block">Title<input name={`${m.module}Title`} defaultValue={config.indexes[m.module].title} className={inputClass} maxLength={80} placeholder={m.label} /></label>
                  <label className="mt-1 block">Introduction<textarea name={`${m.module}Intro`} defaultValue={config.indexes[m.module].intro} className={`${inputClass} min-h-12`} maxLength={400} /></label>
                </fieldset>
              ))}
            </>
          </SettingsSection>
        </Card>
        <Card title="Site metadata">
          <SettingsSection action={saveMetadataAction} hidden={hidden}>
            <>
              <label className="block">Default title<input name="defaultTitle" defaultValue={config.metadata.defaultTitle} className={inputClass} required maxLength={70} /></label>
              <label className="block">Title suffix<input name="titleSuffix" defaultValue={config.metadata.titleSuffix} className={inputClass} maxLength={40} /></label>
              <p className="text-xs text-ink-subtle">Page titles read “Page title · suffix”; the home page uses the default title alone. The platform&apos;s name never appears on a customer site.</p>
              <label className="block">Default description<textarea name="defaultDescription" defaultValue={config.metadata.defaultDescription} className={`${inputClass} min-h-16`} maxLength={200} /></label>
              <label className="block">Language<input name="language" defaultValue={config.metadata.language} className={inputClass} maxLength={35} placeholder="en" /></label>
              <p className="text-xs text-ink-subtle">Language tag of the site&apos;s content, such as en, es or pt-BR; set on every public page for browsers and assistive technology.</p>
              <label className="block">Favicon image
                <select name="faviconAssetId" defaultValue={config.metadata.faviconAssetId ?? ""} className={selectClass}>
                  <option value="">Generated monogram in the brand colours</option>
                  {data.assets.filter((a) => a.width === a.height).map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
                </select>
              </label>
              <p className="text-xs text-ink-subtle">Square images from the media library are offered; 256×256 or larger works best. Without one, browsers get a monogram of the wordmark&apos;s first letter on the primary colour.</p>
              <label className="block">Share image
                <select name="shareImageAssetId" defaultValue={config.metadata.shareImageAssetId ?? ""} className={selectClass}>
                  <option value="">None</option>
                  {data.assets.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
                </select>
              </label>
              <p className="text-xs text-ink-subtle">Shown when a link to the site is shared; a page&apos;s own featured image takes precedence. 1200×630 works best.</p>
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
          <p className="mb-2 text-sm text-ink-muted">A hostname is registered here, then with the hosting provider, verified by the provider, and activated by an owner. Only active domains of a live site are served; aliases redirect to the canonical domain. No DNS value is inferred here: the records shown come from the provider.</p>
          {!providerConfigured ? <p className="mb-2 text-xs text-ink-subtle">No hosting provider is configured in this environment, so registration and verification stop at the dashboard record.</p> : null}
          {data.domains.length === 0 ? <p className="text-sm text-ink-muted">No domains registered.</p> : (
            <ul className="mb-3 divide-y divide-line">
              {data.domains.map((d) => (
                <DomainRow
                  key={d.id}
                  siteId={siteId}
                  siteMode={site.mode}
                  providerConfigured={providerConfigured}
                  canManage={ctx.capabilities.isOwner}
                  domain={{ id: d.id, host: d.normalizedHost, status: d.status, isCanonical: d.isCanonical, verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null, provider: d.verificationInstructions }}
                />
              ))}
            </ul>
          )}
          {ctx.capabilities.isOwner ? (
            <SettingsSection action={addDomainAction} hidden={{ siteId }} submitLabel="Register hostname">
              <label className="block">Hostname<input name="host" className={inputClass} placeholder="www.example.com" /></label>
              <label className="flex items-center gap-2"><input type="checkbox" name="canonical" /> Canonical domain (one per site)</label>
            </SettingsSection>
          ) : <p className="text-xs text-ink-subtle">Only organization owners manage domains.</p>}
        </Card>
        <Card title="Publishing mode">
          {ctx.capabilities.isOwner ? (
            <SiteModeForm siteId={siteId} mode={site.mode} hasRelease={site.activeReleaseId !== null} hasCanonicalDomain={Boolean(canonical)} demoUrl={demoUrl} liveUrl={liveUrl} />
          ) : (
            <p className="text-sm">Mode: <Badge tone={site.mode === "live" ? "success" : "warning"}>{site.mode}</Badge> Only organization owners change the publishing mode.</p>
          )}
        </Card>
      </div>
    </>
  );
}

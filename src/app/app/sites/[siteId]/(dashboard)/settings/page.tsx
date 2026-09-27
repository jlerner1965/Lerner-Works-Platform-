import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getCurrentSiteConfig } from "@/server/data/sites";
import { Badge, Card, PageHeader, inputClass, selectClass, formatDateTime } from "@/components/admin/ui";
import { SettingsSection } from "@/components/admin/settings-forms";
import { saveNavigationAction, saveModulesAction, saveIndexesAction, saveMetadataAction, setReviewPolicyAction, saveContactAction, addDomainAction } from "@/server/actions/settings";
import { moduleIndexRoutes } from "@/modules/registry";
import type { IndexModuleKey } from "@/modules/site-config";
import { getConfig } from "@/server/config";
import { getDomainProvider, type DomainProviderStatus } from "@/server/domains/provider";
import { DomainRow, SiteModeForm } from "@/components/admin/domain-forms";

export const dynamic = "force-dynamic";

const sections = [
  { id: "site-details", label: "Site details" },
  { id: "metadata", label: "Metadata" },
  { id: "modules", label: "Modules" },
  { id: "listing-pages", label: "Listing pages" },
  { id: "navigation", label: "Navigation and footer" },
  { id: "domains", label: "Domains" },
  { id: "publishing", label: "Publishing" },
] as const;

/** Settings (B1): everything about the site that is not its look. Brand and design live on the Look page. */
export default async function SettingsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/settings`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canManageSettings) notFound();
  const data = await withUser(user.id, async (db) => {
    const config = await getCurrentSiteConfig(db, siteId);
    const domains = await db<Array<{ id: string; normalizedHost: string; status: "pending" | "verifying" | "active" | "disabled"; isCanonical: boolean; verifiedAt: Date | null; createdAt: Date; verificationInstructions: DomainProviderStatus | null }>>`select id, normalized_host, status::text, is_canonical, verified_at, created_at, verification_instructions from public.domains where site_id = ${siteId} order by created_at`;
    const assets = await db<Array<{ id: string; title: string | null; width: number; height: number }>>`select id, title, width, height from public.media_assets where site_id = ${siteId} and status = 'ready' and kind = 'image' order by created_at desc limit 100`;
    return { config, domains, assets };
  });
  if (!data.config) notFound();
  const { config } = data.config;
  const hidden = { siteId, baseRevisionId: data.config.id };
  const site = ctx.site;
  const cfg = getConfig();
  const providerConfigured = getDomainProvider() !== null;
  const canonical = data.domains.find((d) => d.isCanonical && d.status === "active" && d.verifiedAt);
  const demoUrl = `${cfg.APP_URL}/demo/${site.key}`;
  const liveUrl = canonical ? `https://${canonical.normalizedHost}/` : null;
  const assetLabel = (a: { id: string; title: string | null; width: number; height: number }) => `${a.title || a.id.slice(0, 8)} (${a.width}×${a.height})`;
  const enabledIndexes = moduleIndexRoutes.filter((m) => config.modules[m.module]).map((m) => ({ ...m, module: m.module as IndexModuleKey }));
  return (
    <>
      <PageHeader
        eyebrow={ctx.organization.name}
        title="Settings"
        description={`Configuration revision ${data.config.version} (saved ${formatDateTime(data.config.createdAt, site.timeZone)}). Every save creates a new immutable configuration revision; the public site changes when you publish. Brand, composition and design options are on the Look page.`}
      />
      <nav aria-label="Settings sections" className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {sections.map((s) => <a key={s.id} href={`#${s.id}`} className="text-action underline">{s.label}</a>)}
      </nav>
      <div className="grid gap-4 lg:grid-cols-2">
        <div id="site-details">
          <Card title="Site details">
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
        </div>
        <div id="metadata">
          <Card title="Metadata">
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
        </div>
        <div id="modules">
          <Card title="Modules">
            <SettingsSection action={saveModulesAction} hidden={hidden}>
              <>
                <p className="text-xs text-ink-subtle">Disabling a module removes its routes from the next release. Pages that still depend on it are reported as blockers; nothing is deleted. With Inquiries off, the published site rejects form submissions and store pages show no form.</p>
                {(["places", "events", "articles", "stores", "services", "links", "inquiries"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 capitalize"><input type="checkbox" name={m} defaultChecked={config.modules[m]} /> {m}</label>
                ))}
              </>
            </SettingsSection>
          </Card>
        </div>
        <div id="listing-pages">
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
        </div>
        <div id="navigation">
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
                <fieldset><legend className="font-medium">Header button</legend>
                  <p className="text-xs text-ink-subtle">Compositions with a button in the header show this label and link; leave both empty for the composition&apos;s own default (the retail compositions show &quot;Find a store&quot; while the stores module is on; the guide compositions show no button).</p>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <input name="ctaLabel" defaultValue={config.navigation.cta?.label ?? ""} placeholder="Label" aria-label="Header button label" className={inputClass} maxLength={40} />
                    <input name="ctaPath" defaultValue={config.navigation.cta?.path ?? ""} placeholder="/path or https://…" aria-label="Header button path" className={inputClass} />
                  </div>
                </fieldset>
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
        </div>
        <div id="domains">
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
        </div>
        <div id="publishing">
          <Card title="Publishing">
            {ctx.capabilities.isOwner ? (
              <SiteModeForm siteId={siteId} mode={site.mode} hasRelease={site.activeReleaseId !== null} hasCanonicalDomain={Boolean(canonical)} demoUrl={demoUrl} liveUrl={liveUrl} />
            ) : (
              <p className="text-sm">Mode: <Badge tone={site.mode === "live" ? "success" : "warning"}>{site.mode}</Badge> Only organization owners change the publishing mode.</p>
            )}
            <div className="mt-4 border-t border-line pt-3">
              <p className="font-medium">Review policy</p>
              {ctx.capabilities.isOwner ? (
                <SettingsSection action={setReviewPolicyAction} hidden={{ siteId }} submitLabel="Save review policy">
                  <>
                    <p className="text-xs text-ink-subtle">Off: saves by owners and publishers are approved as they are saved and can be published at once; editors&apos; work still needs a publisher&apos;s approval. On: every saved revision needs an explicit approval before it can publish, including your own (four eyes).</p>
                    <label className="flex items-center gap-2"><input type="checkbox" name="reviewRequired" defaultChecked={site.reviewRequired} /> Require an explicit approval before anything publishes</label>
                    <p className="text-xs text-ink-subtle">Currently: {site.reviewRequired ? "review required" : "not required; saves by owners and publishers are approved on save"}.</p>
                  </>
                </SettingsSection>
              ) : (
                <p className="text-sm">Review: <Badge tone="neutral">{site.reviewRequired ? "required for every revision" : "not required; publishers' saves are approved on save"}</Badge> Only organization owners change the review policy.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

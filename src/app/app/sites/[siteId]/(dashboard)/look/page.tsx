import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { withUser } from "@/server/data/db";
import { getCurrentSiteConfig } from "@/server/data/sites";
import { Badge, Card, LinkButton, PageHeader, inputClass, selectClass, formatDateTime } from "@/components/admin/ui";
import { SettingsSection } from "@/components/admin/settings-forms";
import { saveBrandingAction, saveDesignAction, setDesignDelegationAction } from "@/server/actions/settings";
import { formatRatio } from "@/lib/contrast";
import { brandPairings } from "@/lib/brand-tokens";
import { tokenOverrideKeys } from "@/modules/site-config";
import { typographyPresets } from "@/themes/fonts";
import { capabilitiesFor, capabilitiesForPreset, themesForPreset } from "@/themes/capabilities";

export const dynamic = "force-dynamic";

/**
 * Look (site-building programme B1): brand, composition and design options on one page,
 * with the saved configuration previewed beside them. Every save is a configuration
 * revision; the public site changes when the site is published.
 */
export default async function LookPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser(`/app/sites/${siteId}/look`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canManageSettings) notFound();
  const data = await withUser(user.id, async (db) => {
    const config = await getCurrentSiteConfig(db, siteId);
    const assets = await db<Array<{ id: string; title: string | null; width: number; height: number }>>`select id, title, width, height from public.media_assets where site_id = ${siteId} and status = 'ready' and kind = 'image' order by created_at desc limit 100`;
    return { config, assets };
  });
  if (!data.config) notFound();
  const { config } = data.config;
  const hidden = { siteId, baseRevisionId: data.config.id };
  const c = config.branding.colors;
  const pairings = brandPairings(c, config.design.overrides);
  const failing = pairings.filter((p) => !p.passes).length;
  const site = ctx.site;
  const theme = capabilitiesFor(site.preset, config.design);
  const themeChoices = themesForPreset(site.preset);
  const presetTheme = capabilitiesForPreset(site.preset);
  const overrideLabels: Record<(typeof tokenOverrideKeys)[number], string> = { surface: "Tinted panels and bands", surfaceStrong: "Stronger tint (placeholders)", muted: "Secondary text", border: "Dividers and card outlines", borderStrong: "Form field borders", focus: "Keyboard focus ring" };
  const assetLabel = (a: { id: string; title: string | null; width: number; height: number }) => `${a.title || a.id.slice(0, 8)} (${a.width}×${a.height})`;
  const canDesign = ctx.capabilities.canDesign;
  const previewable = canDesign && site.activeReleaseId !== null;
  return (
    <>
      <PageHeader
        eyebrow={ctx.organization.name}
        title="Look"
        description={`Brand, composition and design options. Configuration revision ${data.config.version} (saved ${formatDateTime(data.config.createdAt, site.timeZone)}); every save is a new revision and the public site changes when you publish.`}
        actions={previewable ? <LinkButton variant="secondary" href={`/app/sites/${siteId}/previews/design`}>Full preview at 390, 768 and 1440</LinkButton> : null}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
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
                <label className="block">Logo for dark surfaces
                  <select name="logoDarkAssetId" defaultValue={config.branding.logoDarkAssetId ?? ""} className={selectClass}>
                    <option value="">Wordmark text (no dark logo)</option>
                    {data.assets.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
                  </select>
                </label>
                <p className="text-xs text-ink-subtle">Used where the composition puts the brand on the primary colour or a dark band (the guide&apos;s footer, the storefront&apos;s header bar). Without it those places show the wordmark, because a logo drawn for the light background may vanish there.</p>
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
          <Card title="Design">
            {canDesign ? (
              <>
                <SettingsSection action={saveDesignAction} hidden={hidden}>
                  <>
                    <p className="text-xs text-ink-subtle">The theme is the composition this site renders with; the choices below are the ones the {theme.label} theme offers. Each page section also has its own style and appearance in the editor; publication checks every choice against the theme. A theme change is a configuration revision: the public site changes when you publish, and earlier releases keep the theme they were published with. Every save is audited.</p>
                    <div>
                      <label className="block">Theme
                        <select name="theme" defaultValue={config.design.theme} className={selectClass} aria-describedby="design-theme-description">
                          <option value="default">Preset default ({presetTheme.label})</option>
                          {themeChoices.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                      </label>
                      <p id="design-theme-description" className="mt-1 text-xs text-ink-subtle">{theme.description}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">Header layout
                        <select name="header" defaultValue={config.design.header} className={selectClass}>
                          <option value="default">Theme default ({theme.defaults.header})</option>
                          {theme.header.map((h) => <option key={h} value={h}>{h === "left" ? "Brand left, navigation right" : h === "centered" ? "Brand and navigation centred" : "Header over the hero band"}</option>)}
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
                {ctx.capabilities.isOwner ? (
                  <div className="mt-4 border-t border-line pt-3">
                    <SettingsSection action={setDesignDelegationAction} hidden={{ siteId }} submitLabel="Save delegation">
                      <>
                        <p className="font-medium">Delegation</p>
                        <p className="text-xs text-ink-subtle">Design is the agency&apos;s work (decision D-017). Switch this on only for a customer whose publishers should change this site&apos;s design themselves; the switch is audited and the database refuses design changes from anyone else.</p>
                        <label className="flex items-center gap-2"><input type="checkbox" name="delegated" defaultChecked={site.designDelegated} /> Let this site&apos;s publishers change its design</label>
                        <p className="text-xs text-ink-subtle">Currently: {site.designDelegated ? "delegated to this site's publishers" : "organization owners only"}.</p>
                      </>
                    </SettingsSection>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-ink-muted">The composition and design options are the agency&apos;s work: organization owners change them, or this site&apos;s publishers once an owner delegates design to them. The brand above stays yours to edit.</p>
            )}
          </Card>
        </div>
        <Card title="Preview of the saved configuration" className="xl:sticky xl:top-4 xl:self-start">
          {previewable ? (
            <>
              <iframe title="Design preview" src={`/app/sites/${siteId}/previews/design/render`} className="h-[72vh] w-full rounded border border-line bg-white" />
              <p className="mt-2 text-xs text-ink-subtle">The saved configuration over the active release, at this panel&apos;s width. Save a card above and the preview follows; nothing is published until you publish.</p>
            </>
          ) : site.activeReleaseId === null ? (
            <p className="text-sm text-ink-muted">The preview renders the saved configuration over the published site. Publish a first release to see it here.</p>
          ) : (
            <p className="text-sm text-ink-muted">The design preview is available to the people who may change the design.</p>
          )}
        </Card>
      </div>
    </>
  );
}

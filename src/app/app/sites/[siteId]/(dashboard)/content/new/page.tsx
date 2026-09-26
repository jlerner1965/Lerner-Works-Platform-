import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { isContentKind, kindRegistry, type ContentKind } from "@/modules/registry";
import { presets } from "@/modules/presets";
import { PageHeader } from "@/components/admin/ui";
import { NewItemForm } from "@/components/admin/new-item-form";
import { withUser } from "@/server/data/db";
import { loadCategories } from "@/server/data/editor-context";

export const dynamic = "force-dynamic";

export default async function NewItemPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { siteId } = await params;
  const { kind } = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}/content/new`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canEdit) notFound();
  const kinds = (presets[ctx.site.preset].kinds as ContentKind[]).map((k) => ({ kind: k, label: kindRegistry[k].label, plural: kindRegistry[k].plural }));
  const initial = kind && isContentKind(kind) && kinds.some((k) => k.kind === kind) ? kind : "page";
  const categories = kinds.some((k) => k.kind === "place") ? await withUser(user.id, (db) => loadCategories(db, siteId)) : [];
  return (
    <>
      <PageHeader eyebrow={ctx.site.name} title="New item" description="Creates a draft with the site's defaults; the editor opens for the details. Nothing is public until a release that includes it is activated." />
      <NewItemForm siteId={siteId} kinds={kinds} initialKind={initial} categories={categories} />
    </>
  );
}

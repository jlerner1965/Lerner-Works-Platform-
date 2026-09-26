import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getSiteContext } from "@/server/data/access";
import { isContentKind, kindRegistry, type ContentKind } from "@/modules/registry";
import { presets } from "@/modules/presets";
import { PageHeader } from "@/components/admin/ui";
import { NewItemForm } from "@/components/admin/new-item-form";

export const dynamic = "force-dynamic";

export default async function NewItemPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { siteId } = await params;
  const { kind } = await searchParams;
  const user = await requireUser(`/app/sites/${siteId}/content/new`);
  const ctx = await getSiteContext(user.id, siteId);
  if (!ctx || !ctx.capabilities.canEdit) notFound();
  const kinds = (presets[ctx.site.preset].kinds as ContentKind[]).map((k) => ({ kind: k, label: kindRegistry[k].label, plural: kindRegistry[k].plural }));
  const initial = kind && isContentKind(kind) && kinds.some((k) => k.kind === kind) ? kind : "page";
  return (
    <>
      <PageHeader eyebrow={ctx.site.name} title="New item" description="Creates a draft. Nothing is public until a release that includes it is activated." />
      <NewItemForm siteId={siteId} kinds={kinds} initialKind={initial} />
    </>
  );
}

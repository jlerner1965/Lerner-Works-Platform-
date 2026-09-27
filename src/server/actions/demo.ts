"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { loadDemoContent } from "@/server/demo/load";

/** Owner-only: loads the fictional fixtures into a demonstration site through the normal services. */
export async function loadDemoContentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const siteId = String(formData.get("siteId") ?? "");
  if (!z.uuid().safeParse(siteId).success) redirect("/app");
  try {
    const result = await loadDemoContent(user.id, siteId);
    revalidatePath(`/app/sites/${siteId}`);
    redirect(`/app/sites/${siteId}?demo=${encodeURIComponent(`${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged, ${result.images} images, ${result.documents} documents, ${result.releases.length} releases`)}`);
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
    redirect(`/app/sites/${siteId}?demoError=${encodeURIComponent((err as Error).message.slice(0, 300))}`);
  }
}

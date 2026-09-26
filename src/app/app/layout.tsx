import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/app");
  return <>{children}</>;
}

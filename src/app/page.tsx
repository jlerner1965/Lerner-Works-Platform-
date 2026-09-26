import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";

export default async function IndexPage() {
  const user = await getSessionUser();
  redirect(user ? "/app" : "/sign-in");
}

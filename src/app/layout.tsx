import type { Metadata } from "next";
import { publicDocumentLanguage } from "@/server/publishing/public-document";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lerner Works Platform", template: "%s · Lerner Works Platform" },
  description: "Agency-operated website platform dashboard.",
  robots: { index: false, follow: false },
};

/**
 * Single root layout for the dashboard and the public sites. Public pages replace the title
 * template, icons and description through their own metadata; the document language comes
 * from the site's configuration on public routes and is English for the dashboard.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await publicDocumentLanguage();
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}

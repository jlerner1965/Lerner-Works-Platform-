import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lerner Works Platform", template: "%s · Lerner Works Platform" },
  description: "Agency-operated website platform dashboard.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

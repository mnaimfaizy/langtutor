import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { getCurrentExperienceMode } from "@/lib/db/server";
import { SITE_URL } from "@/lib/config/site";
import { paletteBootstrapScript } from "@/lib/theme";
import "./globals.css";
import { MotionProvider } from "./motion-provider";
import { PageTransition } from "./page-transition";
import { SeedBootstrap } from "./seed-bootstrap";
import { SettingsBootstrap } from "./settings-bootstrap";
import { SiteHeader } from "./site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Lang-Tutor",
  description: "A private, local-first English tutor — reading, writing, listening, and speaking.",
  applicationName: "Lang-Tutor",
  appleWebApp: { capable: true, title: "Lang-Tutor", statusBarStyle: "default" },
};

// Matches the premium-dark brand's --accent token (ADR 0017): adult-light indigo,
// adult-dark periwinkle. Kept in sync with app/globals.css by hand — both are tiny,
// stable brand constants rather than a shared source of truth worth extracting.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5b3df0" },
    { media: "(prefers-color-scheme: dark)", color: "#8b7bff" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const experienceMode = await getCurrentExperienceMode();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: paletteBootstrapScript(experienceMode) }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SerwistProvider swUrl="/serwist/sw.js">
          <MotionProvider>
            <SettingsBootstrap />
            <SeedBootstrap />
            <SiteHeader />
            <PageTransition>{children}</PageTransition>
          </MotionProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}

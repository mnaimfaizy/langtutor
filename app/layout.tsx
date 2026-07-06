import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { getCurrentExperienceMode } from "@/lib/db/server";
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
  title: "Lang-Tutor",
  description: "A private, local-first English tutor — reading, writing, listening, and speaking.",
  applicationName: "Lang-Tutor",
  appleWebApp: { capable: true, title: "Lang-Tutor", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
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

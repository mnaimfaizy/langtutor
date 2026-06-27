import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SerwistProvider } from "@serwist/turbopack/react";
import "./globals.css";
import { ConnectivityIndicator } from "./connectivity-indicator";
import { GamificationHud } from "./gamification-hud";
import { HeaderAuth } from "./header-auth";
import { MotionProvider } from "./motion-provider";
import { PWAInstallButton } from "./pwa-install-button";
import { PageTransition } from "./page-transition";
import { SeedBootstrap } from "./seed-bootstrap";
import { SettingsBootstrap } from "./settings-bootstrap";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SerwistProvider swUrl="/serwist/sw.js">
          <MotionProvider>
            <SettingsBootstrap />
            <SeedBootstrap />
            <header className="border-border bg-card/50 sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-6 py-3 backdrop-blur">
              <Link href="/" className="text-foreground text-sm font-semibold">
                Lang-Tutor
              </Link>
              <div className="flex items-center gap-4">
                <GamificationHud />
                <ConnectivityIndicator />
                <PWAInstallButton />
                <Link href="/settings" className="text-muted hover:text-foreground text-sm">
                  Settings
                </Link>
                <HeaderAuth />
              </div>
            </header>
            <PageTransition>{children}</PageTransition>
          </MotionProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}

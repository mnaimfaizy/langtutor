import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ConnectivityIndicator } from "./connectivity-indicator";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SettingsBootstrap />
        <header className="border-border bg-card/50 sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-6 py-3 backdrop-blur">
          <Link href="/" className="text-foreground text-sm font-semibold">
            Lang-Tutor
          </Link>
          <div className="flex items-center gap-4">
            <ConnectivityIndicator />
            <Link href="/settings" className="text-muted hover:text-foreground text-sm">
              Settings
            </Link>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}

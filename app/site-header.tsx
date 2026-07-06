import Link from "next/link";

import { buttonClassName } from "@/ui";
import { ConnectivityIndicator } from "./connectivity-indicator";
import { GamificationHud } from "./gamification-hud";
import { HeaderAuth } from "./header-auth";
import { SettingsIcon } from "./icons";
import { PWAInstallButton } from "./pwa-install-button";

/**
 * App shell chrome: a sticky, translucent glass bar. Brand mark always visible; the
 * wordmark and secondary status (XP/streak, Mac connectivity) condense away below the
 * `sm` breakpoint so the bar never crowds a phone-width screen, while primary actions
 * (Settings, auth) keep full-height (40px) tap targets at every size.
 */
export function SiteHeader() {
  return (
    <header className="border-glass-border bg-glass sticky top-0 z-20 border-b backdrop-blur-lg">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/"
          aria-label="Lang-Tutor home"
          className="focus-visible:ring-accent focus-visible:ring-offset-background flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span
            aria-hidden
            className="from-gradient-from via-gradient-via to-gradient-to text-gradient-foreground shadow-glow flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold"
          >
            L
          </span>
          <span className="text-foreground hidden text-base font-semibold tracking-tight sm:inline">
            Lang-Tutor
          </span>
        </Link>

        <nav aria-label="Primary" className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <GamificationHud />
            <ConnectivityIndicator />
          </div>
          <PWAInstallButton />
          <Link
            href="/settings"
            aria-label="Settings"
            className={buttonClassName({
              variant: "ghost",
              size: "md",
              className: "gap-1.5 px-2.5 sm:px-3",
            })}
          >
            <SettingsIcon className="size-4" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <HeaderAuth />
        </nav>
      </div>
    </header>
  );
}

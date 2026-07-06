"use client";

import { useEffect, useState } from "react";

import { InstallIcon } from "./icons";
import { Button } from "@/ui";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Captures the browser's `beforeinstallprompt` event and shows an "Install app" button.
 * Renders nothing after the app is installed or when the browser doesn't support the prompt.
 */
export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setDeferredPrompt(null));
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (!deferredPrompt) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void handleInstall()}
      aria-label="Install Lang-Tutor as an app"
      className="gap-1.5 px-2.5 sm:px-3"
    >
      <InstallIcon className="size-4" />
      <span className="hidden sm:inline">Install app</span>
    </Button>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { settingsToOverrides } from "@/lib/llm/settings";
import { getContentRepository } from "@/lib/registry";

/**
 * On app load, push the user's saved Mac settings (IndexedDB) to the server-held runtime
 * overrides, so server-side LLM + STT calls honor them after a server restart. Renders nothing.
 */
export function SettingsBootstrap() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/login")) return;
    let active = true;
    void getContentRepository()
      .getSettings()
      .then((settings) => {
        if (!active) return;
        const llmOverrides = settingsToOverrides(settings);
        const pushLlm = Object.values(llmOverrides).some(Boolean)
          ? fetch("/api/llm/config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(llmOverrides),
            })
          : Promise.resolve();

        const pushStt = settings?.macSttUrl
          ? fetch("/api/stt/config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sttUrl: settings.macSttUrl }),
            })
          : Promise.resolve();

        return Promise.all([pushLlm, pushStt]);
      })
      .then(() => {
        // Fire warm-up as best-effort background task to pre-load the model into VRAM.
        void fetch("/api/llm/warmup", { method: "POST" }).catch(() => {});
      })
      .catch(() => {
        // Best-effort; the indicator will surface unreachability.
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}

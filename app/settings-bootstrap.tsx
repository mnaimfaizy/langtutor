"use client";

import { useEffect } from "react";

import { settingsToOverrides } from "@/lib/llm/settings";
import { getContentRepository } from "@/lib/registry";

/**
 * On app load, push the user's saved Mac settings (IndexedDB) to the server-held runtime
 * override, so server-side LLM calls honor them after a server restart. Renders nothing.
 */
export function SettingsBootstrap() {
  useEffect(() => {
    let active = true;
    void getContentRepository()
      .getSettings()
      .then((settings) => {
        if (!active) return;
        const overrides = settingsToOverrides(settings);
        if (!Object.values(overrides).some(Boolean)) return; // nothing configured yet
        return fetch("/api/llm/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(overrides),
        });
      })
      .catch(() => {
        // Best-effort; the indicator will surface unreachability.
      });
    return () => {
      active = false;
    };
  }, []);

  return null;
}

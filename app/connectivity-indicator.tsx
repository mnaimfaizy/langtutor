"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { HealthResponseSchema } from "@/lib/llm/settings";
import { cn } from "@/ui";

type MacStatus = "checking" | "reachable" | "unreachable";

const HEALTH_POLL_MS = 30_000;

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Small status badge: browser online/offline + whether the Mac (Ollama) is reachable via
 * `/api/llm/health`. Polls on mount, on window focus, on reconnect, and every 30s.
 */
export function ConnectivityIndicator() {
  // useSyncExternalStore reads navigator.onLine without a setState-in-effect.
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true, // SSR snapshot: assume online
  );
  const [mac, setMac] = useState<MacStatus>("checking");

  useEffect(() => {
    let active = true;

    async function ping() {
      try {
        const res = await fetch("/api/llm/health", { cache: "no-store" });
        const parsed = HealthResponseSchema.safeParse(await res.json());
        if (active)
          setMac(res.ok && parsed.success && parsed.data.ok ? "reachable" : "unreachable");
      } catch {
        if (active) setMac("unreachable");
      }
    }

    void ping();
    const onFocus = () => void ping();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    const timer = setInterval(() => void ping(), HEALTH_POLL_MS);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      clearInterval(timer);
    };
  }, []);

  const label = !online
    ? "Offline"
    : mac === "reachable"
      ? "Mac connected"
      : mac === "checking"
        ? "Checking…"
        : "Mac unreachable";
  const dot = !online
    ? "bg-muted"
    : mac === "reachable"
      ? "bg-success"
      : mac === "checking"
        ? "bg-warning"
        : "bg-danger";

  return (
    <span
      className="text-muted inline-flex items-center gap-2 text-xs"
      title={label}
      aria-live="polite"
    >
      <span className={cn("size-2 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}

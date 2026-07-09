"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";

/**
 * Wraps Serwist so e2e / automated browsers never register the service worker.
 *
 * Playwright's `serviceWorkers: "block"` replaces `navigator.serviceWorker.register`
 * with a stub that returns `undefined`. Serwist then throws
 * `Cannot read properties of undefined (reading 'waiting')`, which breaks App Router
 * client navigations. Disabling registration keeps `page.route` Mac stubs effective
 * (Serwist's NetworkOnly handlers otherwise bypass Playwright routing).
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const disable =
    process.env.NEXT_PUBLIC_E2E === "1" ||
    (typeof navigator !== "undefined" && navigator.webdriver === true);

  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={disable}>
      {children}
    </SerwistProvider>
  );
}

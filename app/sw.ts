/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import {
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

// Service worker source — compiled by esbuild via app/serwist/[path]/route.ts, NOT by the
// app's tsc/Turbopack build (it's excluded from tsconfig to avoid dom/webworker lib clashes).

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Mac-dependent API routes: never cache. These require the Mac to be reachable and must
// always go to the network; a stale cache hit would be misleading or incorrect.
const macDependentApis: RuntimeCaching = {
  matcher: ({ url: { pathname }, sameOrigin }) =>
    sameOrigin &&
    /^\/api\/(llm|stt|reading\/generate|reading\/questions|writing\/generate|writing\/feedback|agent)/.test(
      pathname,
    ),
  handler: new NetworkOnly(),
};

// Lexicon GET routes: safe to cache offline. Backed by bundled WordNet/CEFR data +
// Free Dictionary API; stale responses are still useful when network is unavailable.
const lexiconApis: RuntimeCaching = {
  matcher: ({ url: { pathname }, sameOrigin }) =>
    sameOrigin && pathname.startsWith("/api/lexicon/"),
  method: "GET",
  handler: new StaleWhileRevalidate({
    cacheName: "lexicon-api",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 })],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Custom rules first; defaultCache handles all remaining asset classes.
  runtimeCaching: [macDependentApis, lexiconApis, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

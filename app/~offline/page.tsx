import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline — Lang-Tutor",
};

/** Precached fallback shown when a navigation is requested while offline and uncached. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-foreground text-xl font-semibold">You are offline</h1>
      <p className="text-muted mt-2 text-sm leading-6">
        This page is not cached yet. Reconnect to load it. Your saved decks, cached passages, and
        settings still work offline.
      </p>
    </main>
  );
}

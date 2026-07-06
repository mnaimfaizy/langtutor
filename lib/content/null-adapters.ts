import type { ContentSink, NewContent } from "@/lib/db";

/**
 * Server-side no-op {@link ContentSink}. Route handlers pass this to
 * {@link generateContent} when the server should not persist content — the client
 * caches the result in IndexedDB after receiving the response.
 */
export class NoopContentSink implements ContentSink {
  putContent(_c: NewContent): Promise<number> {
    return Promise.resolve(0);
  }
}

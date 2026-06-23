"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Cefr, Content } from "@/lib/db";
import { PassageSchema } from "@/lib/content/passage";
import { getContentRepository } from "@/lib/registry";
import { cn } from "@/ui/cn";

const CEFR_COLOR: Record<Cefr, string> = {
  A1: "text-success",
  A2: "text-success",
  B1: "text-warning",
  B2: "text-warning",
  C1: "text-danger",
  C2: "text-danger",
};

export function ListeningClient() {
  const [library, setLibrary] = useState<Content[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void getContentRepository()
      .queryContent({ type: "passage" })
      .then((passages) => {
        if (!active) return;
        setLibrary(passages.slice().reverse());
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-10">
        <section>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Listening</h1>
          <p className="text-muted mt-1 text-sm">
            Pick a passage to practise dictation. Listen, then type what you hear — your word error
            rate is scored instantly, offline.
          </p>
        </section>

        <section>
          <h2 className="text-foreground text-lg font-semibold">Your passages</h2>

          {!loaded ? (
            <p className="text-muted mt-4 text-sm">Loading…</p>
          ) : library.length === 0 ? (
            <p data-testid="library-empty" className="text-muted mt-4 text-sm">
              No passages yet.{" "}
              <Link href="/reading" className="text-accent underline-offset-2 hover:underline">
                Generate one from the Reading page
              </Link>{" "}
              to start practising dictation.
            </p>
          ) : (
            <ul data-testid="passage-library" className="mt-4 space-y-2">
              {library.map((item) => {
                const p = PassageSchema.safeParse(item.payload);
                const title = p.success ? p.data.title : item.topic;
                return (
                  <li key={item.id}>
                    <Link
                      href={`/listening/${item.id}`}
                      data-testid={`passage-item-${item.id}`}
                      className="border-border bg-card hover:border-foreground/20 flex items-center justify-between rounded-xl border px-4 py-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm font-medium">{title}</p>
                        <p className="text-muted mt-0.5 truncate text-xs capitalize">
                          {item.topic} · {item.source}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "ml-4 shrink-0 text-xs font-semibold tracking-wider uppercase",
                          CEFR_COLOR[item.level],
                        )}
                      >
                        {item.level}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

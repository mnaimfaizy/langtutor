"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Content } from "@/lib/db";
import { PassageSchema } from "@/lib/content/passage";
import { getContentRepository } from "@/lib/registry";
import { CEFR_BADGE_VARIANT } from "@/lib/cefr";
import { Badge } from "./badge";
import { Card } from "./card";

interface PassageLibraryClientProps {
  title: string;
  description: string;
  emptyLabel: string;
  basePath: string;
}

export function PassageLibraryClient({
  title,
  description,
  emptyLabel,
  basePath,
}: PassageLibraryClientProps) {
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
    <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-10">
        <section>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted mt-1 text-sm">{description}</p>
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
              to start practising {emptyLabel}.
            </p>
          ) : (
            <ul data-testid="passage-library" className="mt-4 space-y-2">
              {library.map((item) => {
                const p = PassageSchema.safeParse(item.payload);
                const itemTitle = p.success ? p.data.title : item.topic;
                return (
                  <li key={item.id}>
                    <Link
                      href={`${basePath}/${item.id}`}
                      data-testid={`passage-item-${item.id}`}
                      className="focus-visible:ring-accent focus-visible:ring-offset-background block rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <Card className="hover:border-accent/40 hover:shadow-glow flex flex-row items-center justify-between gap-4 py-3 transition-[colors,box-shadow]">
                        <div className="min-w-0">
                          <p className="text-foreground truncate text-sm font-medium">
                            {itemTitle}
                          </p>
                          <p className="text-muted mt-0.5 truncate text-xs capitalize">
                            {item.topic} · {item.source}
                          </p>
                        </div>
                        <Badge variant={CEFR_BADGE_VARIANT[item.level]} className="shrink-0">
                          {item.level}
                        </Badge>
                      </Card>
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

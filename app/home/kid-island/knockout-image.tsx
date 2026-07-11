"use client";

import { useEffect, useState } from "react";

import { cn } from "@/ui";

/**
 * Loads a JPEG sprite and knocks near-white pixels to transparent so generated
 * props sit cleanly on the island map (the source generator can't produce real alpha).
 */
export function KnockoutImage({
  src,
  alt,
  className,
  threshold = 245,
}: {
  src: string;
  alt: string;
  className?: string;
  threshold?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let active = true;

    void (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(bitmap, 0, 0);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = image.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i]!;
          const g = d[i + 1]!;
          const b = d[i + 2]!;
          if (r >= threshold && g >= threshold && b >= threshold) {
            d[i + 3] = 0;
          }
        }
        ctx.putImageData(image, 0, 0);
        const out = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!out || !active) return;
        revoked = URL.createObjectURL(out);
        setUrl(revoked);
        setFailed(false);
      } catch {
        if (active) setFailed(true);
      }
    })();

    return () => {
      active = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [src, threshold]);

  if (failed) {
    return (
      <img src={src} alt={alt} className={cn("object-contain", className)} draggable={false} />
    );
  }

  if (!url) {
    return (
      <div
        className={cn("animate-pulse rounded-xl bg-white/40", className)}
        aria-label={`Loading ${alt}`}
      />
    );
  }

  return <img src={url} alt={alt} className={cn("object-contain", className)} draggable={false} />;
}

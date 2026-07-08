import type { Metadata } from "next";
import { Suspense } from "react";

import { ListenTapSessionLazy } from "./listen-tap-loader";

export const metadata: Metadata = { title: "Listen & Tap — Lang-Tutor" };

export default function ListenTapPage() {
  return (
    <Suspense fallback={null}>
      <ListenTapSessionLazy />
    </Suspense>
  );
}

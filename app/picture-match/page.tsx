import type { Metadata } from "next";
import { Suspense } from "react";

import { PictureMatchSessionLazy } from "./picture-match-loader";

export const metadata: Metadata = { title: "Picture Match — Lang-Tutor" };

export default function PictureMatchPage() {
  return (
    <Suspense fallback={null}>
      <PictureMatchSessionLazy />
    </Suspense>
  );
}

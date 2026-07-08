import type { Metadata } from "next";
import { Suspense } from "react";

import { AlphabetSessionLazy } from "./alphabet-loader";

export const metadata: Metadata = { title: "Alphabet — Lang-Tutor" };

export default function AlphabetPage() {
  return (
    <Suspense fallback={null}>
      <AlphabetSessionLazy />
    </Suspense>
  );
}

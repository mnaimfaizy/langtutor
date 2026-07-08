import type { Metadata } from "next";
import { Suspense } from "react";

import { PhonicsSessionLazy } from "./phonics-loader";

export const metadata: Metadata = { title: "Phonics — Lang-Tutor" };

export default function PhonicsPage() {
  return (
    <Suspense fallback={null}>
      <PhonicsSessionLazy />
    </Suspense>
  );
}

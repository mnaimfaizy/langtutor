import type { Metadata } from "next";
import { Suspense } from "react";

import { ReviewSessionLazy } from "./review-loader";

export const metadata: Metadata = { title: "Review — Lang-Tutor" };

export default function ReviewPage() {
  // Suspense boundary required by `useSearchParams` (embedded-in-unit deep link, issue #59).
  return (
    <Suspense fallback={null}>
      <ReviewSessionLazy />
    </Suspense>
  );
}

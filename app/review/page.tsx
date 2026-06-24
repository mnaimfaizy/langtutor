import type { Metadata } from "next";

import { ReviewSessionLazy } from "./review-loader";

export const metadata: Metadata = { title: "Review — Lang-Tutor" };

export default function ReviewPage() {
  return <ReviewSessionLazy />;
}

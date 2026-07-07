import { Suspense } from "react";

import { SpeakingView } from "./speaking-view";

export default async function SpeakingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Suspense boundary required by `useSearchParams` (embedded-in-unit deep link, issue #60).
  return (
    <Suspense fallback={null}>
      <SpeakingView id={Number(id)} />
    </Suspense>
  );
}

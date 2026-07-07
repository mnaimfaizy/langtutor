import { Suspense } from "react";

import { PassageView } from "./passage-view";

export const metadata = { title: "Passage — Lang-Tutor" };

export default async function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Suspense boundary required by `useSearchParams` (embedded-in-unit deep link, issue #59).
  return (
    <Suspense fallback={null}>
      <PassageView id={Number(id)} />
    </Suspense>
  );
}

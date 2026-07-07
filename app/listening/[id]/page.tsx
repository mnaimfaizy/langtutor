import { Suspense } from "react";

import { DictationView } from "./dictation-view";

export const metadata = { title: "Dictation — Lang-Tutor" };

export default async function DictationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Suspense boundary required by `useSearchParams` (embedded-in-unit deep link, issue #60).
  return (
    <Suspense fallback={null}>
      <DictationView id={Number(id)} />
    </Suspense>
  );
}

import { Suspense } from "react";

import { PromptView } from "./prompt-view";

export const metadata = { title: "Writing Prompt — Lang-Tutor" };

export default async function PromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Suspense boundary required by `useSearchParams` (embedded-in-unit deep link, issue #60).
  return (
    <Suspense fallback={null}>
      <PromptView id={Number(id)} />
    </Suspense>
  );
}

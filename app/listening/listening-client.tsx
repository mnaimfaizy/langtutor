"use client";

import { PassageLibraryClient } from "@/ui/passage-library-client";

export function ListeningClient() {
  return (
    <PassageLibraryClient
      title="Listening"
      description="Pick a passage to practise dictation. Listen, then type what you hear — your word error rate is scored instantly, offline."
      emptyLabel="dictation"
      basePath="/listening"
    />
  );
}

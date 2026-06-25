"use client";

import { PassageLibraryClient } from "@/ui/passage-library-client";

export function SpeakingClient() {
  return (
    <PassageLibraryClient
      title="Speaking"
      description="Pick a passage to read aloud. Your speech is transcribed by Whisper and scored against the reference text — requires the Mac to be reachable."
      emptyLabel="speaking"
      basePath="/speaking"
    />
  );
}

import type { Transcriber } from "./transcriber";

/**
 * Offline {@link Transcriber} for tests. Pass a string to return it as the transcript;
 * pass `null` to simulate the Mac being unreachable (the promise rejects).
 */
export class MockTranscriber implements Transcriber {
  constructor(private readonly text: string | null = "") {}

  async transcribe(_audio: Blob): Promise<string> {
    if (this.text === null) throw new Error("Mac STT server not reachable");
    return this.text;
  }
}

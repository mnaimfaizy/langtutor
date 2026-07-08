import { describe, expect, it, vi } from "vitest";

import { celebrationSoundUrl, playCelebrationSound } from "@/lib/audio/celebration-sounds";

describe("celebrationSoundUrl", () => {
  it("maps session-complete to the bundled asset path", () => {
    expect(celebrationSoundUrl("session-complete")).toBe("/sounds/session-complete.wav");
  });

  it("maps level-up to the bundled asset path", () => {
    expect(celebrationSoundUrl("level-up")).toBe("/sounds/level-up.wav");
  });
});

describe("playCelebrationSound", () => {
  it("is a no-op on the server", () => {
    expect(() => playCelebrationSound("session-complete")).not.toThrow();
  });

  it("plays the mapped asset in the browser", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const AudioMock = vi.fn(function AudioMock(this: { play: typeof play }) {
      this.play = play;
    });
    vi.stubGlobal("window", {});
    vi.stubGlobal("Audio", AudioMock);

    playCelebrationSound("level-up");

    expect(AudioMock).toHaveBeenCalledWith("/sounds/level-up.wav");
    expect(play).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

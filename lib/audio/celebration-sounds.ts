/** Bundled celebration sound keys — static files under `public/sounds/`. */
export type CelebrationSoundKind = "session-complete" | "level-up";

const SOUND_URLS: Record<CelebrationSoundKind, string> = {
  "session-complete": "/sounds/session-complete.wav",
  "level-up": "/sounds/level-up.wav",
};

export function celebrationSoundUrl(kind: CelebrationSoundKind): string {
  return SOUND_URLS[kind];
}

/** Play a celebration sound effect. No-op on the server or when playback is blocked. */
export function playCelebrationSound(kind: CelebrationSoundKind): void {
  if (typeof window === "undefined") return;
  const audio = new Audio(celebrationSoundUrl(kind));
  void audio.play().catch(() => undefined);
}

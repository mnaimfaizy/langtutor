/**
 * Web Audio blips for the kid-island Pre-A1 home — no asset files. Mute is caller-owned;
 * reduced-motion callers should skip whooshes.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

export type IslandSound = "tap" | "success" | "locked" | "whoosh" | "cheer";

export function playIslandSound(kind: IslandSound, muted: boolean): void {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  void ac.resume();

  const now = ac.currentTime;
  const gain = ac.createGain();
  gain.connect(ac.destination);

  const beep = (freq: number, start: number, dur: number, vol = 0.08) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g);
    g.connect(gain);
    osc.start(start);
    osc.stop(start + dur);
  };

  switch (kind) {
    case "tap":
      beep(660, now, 0.08, 0.06);
      break;
    case "success":
      beep(523, now, 0.1, 0.07);
      beep(659, now + 0.08, 0.12, 0.07);
      beep(784, now + 0.18, 0.18, 0.08);
      break;
    case "locked":
      beep(180, now, 0.12, 0.05);
      beep(140, now + 0.08, 0.14, 0.04);
      break;
    case "whoosh":
      beep(320, now, 0.05, 0.03);
      beep(480, now + 0.04, 0.08, 0.04);
      break;
    case "cheer":
      beep(523, now, 0.08, 0.06);
      beep(659, now + 0.06, 0.08, 0.06);
      beep(784, now + 0.12, 0.08, 0.07);
      beep(1046, now + 0.2, 0.22, 0.08);
      break;
  }
}

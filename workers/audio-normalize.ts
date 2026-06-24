import { encodeWav, resample, toMono } from "../lib/audio/normalize";

interface NormalizeMessage {
  channels: Float32Array[];
  sampleRate: number;
}

self.addEventListener("message", (e: MessageEvent<NormalizeMessage>) => {
  const { channels, sampleRate } = e.data;
  const mono = toMono(channels);
  const resampled = resample(mono, sampleRate, 16000);
  const wav = encodeWav(resampled, 16000);
  self.postMessage(wav, { transfer: [wav] });
});

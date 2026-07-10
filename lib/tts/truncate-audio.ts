/**
 * Shared TTS duration helpers (ADR 0030).
 *
 * Cap newly produced clips at ~5s before `putMediaAsset`. Duration is derived from
 * PCM WAV headers (Groq Orpheus returns `audio/wav`). Non-WAV payloads are left
 * unchanged — we cannot safely trim without a decoder.
 */

/** Hard max duration for stored TTS media assets (ADR 0030). */
export const TTS_MAX_DURATION_SECONDS = 5;

interface WavFormat {
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
  blockAlign: number;
  dataOffset: number;
  dataSize: number;
}

function readFourCC(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/**
 * Parse a PCM WAV buffer enough to know sample rate and where the data chunk lives.
 * Returns null when the buffer is not a recognizable PCM WAV.
 */
export function parseWavPcm(data: Uint8Array): WavFormat | null {
  if (data.byteLength < 44) return null;
  // Copy into a standalone ArrayBuffer so DataView indexing is always in-bounds
  // even when `data` is a view into a larger SharedArrayBuffer / pooled buffer.
  const copy = data.slice();
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  if (readFourCC(view, 0) !== "RIFF" || readFourCC(view, 8) !== "WAVE") return null;

  let offset = 12;
  let format: Omit<WavFormat, "dataOffset" | "dataSize"> | null = null;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= view.byteLength) {
    const id = readFourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (chunkStart + size > view.byteLength) return null;

    if (id === "fmt ") {
      if (size < 16) return null;
      const audioFormat = view.getUint16(chunkStart, true);
      const numChannels = view.getUint16(chunkStart + 2, true);
      const sampleRate = view.getUint32(chunkStart + 4, true);
      const bitsPerSample = view.getUint16(chunkStart + 14, true);
      const blockAlign = view.getUint16(chunkStart + 12, true);
      if (audioFormat !== 1 || numChannels < 1 || sampleRate < 1 || bitsPerSample < 8) {
        return null;
      }
      format = { audioFormat, numChannels, sampleRate, bitsPerSample, blockAlign };
    } else if (id === "data") {
      dataOffset = chunkStart;
      dataSize = size;
      break;
    }

    // Chunk sizes are word-aligned.
    offset = chunkStart + size + (size % 2);
  }

  if (!format || dataOffset < 0) return null;
  return { ...format, dataOffset, dataSize };
}

/** Approximate duration in seconds for a WAV payload; null when not measurable. */
export function estimateWavDurationSeconds(data: Uint8Array): number | null {
  const wav = parseWavPcm(data);
  if (!wav) return null;
  const bytesPerSecond = wav.sampleRate * wav.blockAlign;
  if (bytesPerSecond <= 0) return null;
  return wav.dataSize / bytesPerSecond;
}

/**
 * Truncate a PCM WAV to at most `maxSeconds` of audio. Returns the original
 * bytes when already under the cap, or when the payload is not a PCM WAV.
 */
export function truncateWavToMaxDuration(
  data: Uint8Array,
  maxSeconds: number = TTS_MAX_DURATION_SECONDS,
): Uint8Array {
  if (maxSeconds <= 0) return data;
  const wav = parseWavPcm(data);
  if (!wav) return data;

  const maxBytes = Math.floor(maxSeconds * wav.sampleRate) * wav.blockAlign;
  if (wav.dataSize <= maxBytes) return data;

  const truncatedDataSize = maxBytes;
  // Rebuild a minimal PCM WAV: 44-byte header + truncated samples.
  // Keeps only the leading audio; drops any trailing chunks after `data`.
  const out = new Uint8Array(44 + truncatedDataSize);
  const view = new DataView(out.buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + truncatedDataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, wav.audioFormat, true);
  view.setUint16(22, wav.numChannels, true);
  view.setUint32(24, wav.sampleRate, true);
  view.setUint32(28, wav.sampleRate * wav.blockAlign, true);
  view.setUint16(32, wav.blockAlign, true);
  view.setUint16(34, wav.bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, truncatedDataSize, true);
  out.set(data.subarray(wav.dataOffset, wav.dataOffset + truncatedDataSize), 44);
  return out;
}

/**
 * Apply the TTS duration cap to synthesized bytes before persist (ADR 0030).
 * Non-WAV mime types pass through unchanged.
 */
export function applyTtsDurationCap(
  data: Uint8Array,
  mimeType: string,
  maxSeconds: number = TTS_MAX_DURATION_SECONDS,
): Uint8Array {
  if (!mimeType.toLowerCase().includes("wav")) return data;
  return truncateWavToMaxDuration(data, maxSeconds);
}

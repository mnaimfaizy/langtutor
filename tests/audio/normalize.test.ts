import { describe, expect, it } from "vitest";

import { encodeWav, resample, toMono } from "@/lib/audio/normalize";

describe("toMono", () => {
  it("returns empty array for no channels", () => {
    const result = toMono([]);
    expect(result).toHaveLength(0);
  });

  it("returns the same reference for a single channel", () => {
    const ch = new Float32Array([0.1, 0.5, -0.3]);
    expect(toMono([ch])).toBe(ch);
  });

  it("averages two channels element-wise", () => {
    const ch1 = new Float32Array([1.0, 0.0, -1.0]);
    const ch2 = new Float32Array([0.0, 1.0, 1.0]);
    const result = toMono([ch1, ch2]);
    expect(result[0]).toBeCloseTo(0.5);
    expect(result[1]).toBeCloseTo(0.5);
    expect(result[2]).toBeCloseTo(0.0);
  });

  it("averages three channels", () => {
    const ch1 = new Float32Array([0.9]);
    const ch2 = new Float32Array([0.6]);
    const ch3 = new Float32Array([0.3]);
    const result = toMono([ch1, ch2, ch3]);
    expect(result[0]).toBeCloseTo(0.6);
  });
});

describe("resample", () => {
  it("returns the same reference when rates are equal", () => {
    const samples = new Float32Array([1, 2, 3]);
    expect(resample(samples, 16000, 16000)).toBe(samples);
  });

  it("output length is correct when downsampling 44100→16000", () => {
    const samples = new Float32Array(44100);
    const result = resample(samples, 44100, 16000);
    expect(result.length).toBe(Math.round(44100 * (16000 / 44100)));
  });

  it("output length is correct when downsampling 48000→16000", () => {
    const samples = new Float32Array(48000);
    const result = resample(samples, 48000, 16000);
    expect(result.length).toBe(16000);
  });

  it("interpolates values at intermediate positions", () => {
    // [0, 1, 0] at fromRate=3, toRate=2 → ratio=1.5, outLen=2
    // i=0: pos=0.0 → samples[0]=0
    // i=1: pos=1.5 → lerp(samples[1]=1, samples[2]=0, t=0.5) = 0.5
    const samples = new Float32Array([0, 1, 0]);
    const result = resample(samples, 3, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0.5);
  });

  it("clamps to last sample at the boundary", () => {
    // When the last output position maps past samples.length-1, hi is clamped
    const samples = new Float32Array([1, 2, 3]);
    const result = resample(samples, 3, 3); // same rate → identity
    expect(result).toBe(samples);
  });
});

describe("encodeWav", () => {
  it("total buffer size is 44 header bytes + numSamples × 2", () => {
    const samples = new Float32Array(100);
    const buf = encodeWav(samples, 16000);
    expect(buf.byteLength).toBe(44 + 100 * 2);
  });

  it("RIFF/WAVE header is present", () => {
    const buf = encodeWav(new Float32Array(0), 16000);
    const view = new DataView(buf);
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    );
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11),
    );
    expect(riff).toBe("RIFF");
    expect(wave).toBe("WAVE");
  });

  it("encodes the correct sample rate in the fmt chunk", () => {
    const buf = encodeWav(new Float32Array(100), 16000);
    const view = new DataView(buf);
    expect(view.getUint32(24, true)).toBe(16000);
  });

  it("fmt chunk marks PCM (1) and mono (1 channel)", () => {
    const buf = encodeWav(new Float32Array(10), 16000);
    const view = new DataView(buf);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint16(34, true)).toBe(16); // 16-bit
  });

  it("data chunk size equals numSamples × 2", () => {
    const samples = new Float32Array(50);
    const buf = encodeWav(samples, 16000);
    const view = new DataView(buf);
    expect(view.getUint32(40, true)).toBe(100);
  });

  it("encodes 0.0 as 0 in 16-bit PCM", () => {
    const buf = encodeWav(new Float32Array([0.0]), 16000);
    const view = new DataView(buf);
    expect(view.getInt16(44, true)).toBe(0);
  });

  it("encodes 1.0 as max positive 16-bit value", () => {
    const buf = encodeWav(new Float32Array([1.0]), 16000);
    const view = new DataView(buf);
    expect(view.getInt16(44, true)).toBe(0x7fff);
  });

  it("encodes -1.0 as min negative 16-bit value", () => {
    const buf = encodeWav(new Float32Array([-1.0]), 16000);
    const view = new DataView(buf);
    expect(view.getInt16(44, true)).toBe(-0x8000);
  });

  it("clips samples above 1.0 to max positive", () => {
    const buf = encodeWav(new Float32Array([2.0]), 16000);
    const view = new DataView(buf);
    expect(view.getInt16(44, true)).toBe(0x7fff);
  });

  it("clips samples below -1.0 to min negative", () => {
    const buf = encodeWav(new Float32Array([-2.0]), 16000);
    const view = new DataView(buf);
    expect(view.getInt16(44, true)).toBe(-0x8000);
  });

  it("handles zero-sample input (valid header, no data)", () => {
    const buf = encodeWav(new Float32Array(0), 16000);
    expect(buf.byteLength).toBe(44);
    const view = new DataView(buf);
    expect(view.getUint32(40, true)).toBe(0);
  });
});

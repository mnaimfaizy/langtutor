"use client";

import { useCallback, useRef, useState } from "react";

export type MicState = "idle" | "requesting" | "recording" | "processing" | "denied" | "error";

export interface UseRecorderResult {
  state: MicState;
  blob: Blob | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useRecorder(): UseRecorderResult {
  const [state, setState] = useState<MicState>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    setBlob(null);
    setState("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("denied");
      return;
    }

    setState("recording");
    const recorder = new MediaRecorder(stream);
    mediaRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setState("processing");
      const raw = new Blob(chunksRef.current, { type: recorder.mimeType });
      void normalizeBlob(raw)
        .then((normalized) => {
          setBlob(normalized);
          setState("idle");
        })
        .catch(() => setState("error"));
    };

    recorder.start();
  }, []);

  return { state, blob, start, stop };
}

async function normalizeBlob(raw: Blob): Promise<Blob> {
  const arrayBuffer = await raw.arrayBuffer();
  const audioCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
    channels.push(decoded.getChannelData(ch).slice());
  }
  const sampleRate = decoded.sampleRate;

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../../workers/audio-normalize.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      worker.terminate();
      resolve(new Blob([e.data], { type: "audio/wav" }));
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage({ channels, sampleRate }, { transfer: channels.map((c) => c.buffer) });
  });
}

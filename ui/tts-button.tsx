"use client";

import { useEffect, useRef, useState } from "react";

import { getContentRepository } from "@/lib/registry";
import { resolveTtsOptions } from "@/lib/tts/speech-synthesis";
import type { TtsOptions } from "@/lib/tts/speech-synthesis";

import { Button } from "./button";
import { cn } from "./cn";

/**
 * Plays `text` via the browser SpeechSynthesis API. Reads TTS rate and voice from the
 * learner profile on mount so settings apply immediately; works fully offline.
 */
export function TtsButton({ text, className }: { text: string; className?: string }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [opts, setOpts] = useState<TtsOptions>({});
  const [playing, setPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    let active = true;
    void getContentRepository()
      .getSettings()
      .then((s) => {
        if (active) setOpts({ rate: s.ttsRate, voiceUri: s.ttsVoiceUri });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const sync = () => setVoices(window.speechSynthesis.getVoices());
    sync();
    window.speechSynthesis.addEventListener("voiceschanged", sync);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", sync);
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  function handlePlay() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    utteranceRef.current = u;
    const { rate, voice } = resolveTtsOptions(opts, voices);
    u.rate = rate;
    if (voice) u.voice = voice;
    u.addEventListener("start", () => {
      if (utteranceRef.current === u) setPlaying(true);
    });
    u.addEventListener("end", () => {
      if (utteranceRef.current === u) setPlaying(false);
    });
    u.addEventListener("error", () => {
      if (utteranceRef.current === u) setPlaying(false);
    });
    window.speechSynthesis.speak(u);
    setPlaying(true);
  }

  function handleStop() {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setPlaying(false);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={playing ? handleStop : handlePlay}
      aria-label={playing ? "Stop reading aloud" : "Read aloud"}
      className={cn("gap-1", className)}
    >
      <span aria-hidden>{playing ? "⏹" : "▶"}</span>
      {playing ? "Stop" : "Listen"}
    </Button>
  );
}

export interface TtsOptions {
  rate?: number;
  voiceUri?: string;
}

/**
 * Maps TtsOptions + a voice list to resolved values ready to apply to a
 * SpeechSynthesisUtterance. Pure function — no browser globals, fully testable in Node.
 */
export function resolveTtsOptions<V extends { voiceURI: string }>(
  opts: TtsOptions,
  voices: ReadonlyArray<V>,
): { rate: number; voice: V | null } {
  const rate = Math.max(0.1, Math.min(10, opts.rate ?? 1));
  const voice = opts.voiceUri ? (voices.find((v) => v.voiceURI === opts.voiceUri) ?? null) : null;
  return { rate, voice };
}

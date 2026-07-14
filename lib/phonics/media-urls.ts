/** Same-origin media resolve URL for phonics letter sounds (issue #72). */
export function phonicsAudioUrl(letter: string): string {
  return `/api/audio/resolve?word=${encodeURIComponent(letter)}`;
}

/** Word audio for densified phonics rounds anchored on targetVocab. */
export function phonicsWordAudioUrl(word: string): string {
  return `/api/audio/resolve?word=${encodeURIComponent(word)}`;
}

/** Kid illustration for a densified phonics anchor word. */
export function phonicsWordImageUrl(word: string): string {
  return `/api/image/resolve?word=${encodeURIComponent(word)}&style=kid-illustration`;
}

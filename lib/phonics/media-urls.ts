/** Same-origin media resolve URL for phonics letter sounds (issue #72). */
export function phonicsAudioUrl(letter: string): string {
  return `/api/audio/resolve?word=${encodeURIComponent(letter)}`;
}

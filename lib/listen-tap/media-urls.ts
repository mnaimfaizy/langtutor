/** Same-origin media resolve URLs for the listen-and-tap activity (issue #73). */
export function listenTapAudioUrl(audioKey: string): string {
  return `/api/audio/resolve?word=${encodeURIComponent(audioKey)}`;
}

export function listenTapImageUrl(word: string): string {
  return `/api/image/resolve?word=${encodeURIComponent(word)}&style=kid-illustration`;
}

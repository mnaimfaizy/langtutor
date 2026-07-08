/** Same-origin media resolve URLs for the picture-match activity (issue #74). */
export function pictureMatchAudioUrl(audioKey: string): string {
  return `/api/audio/resolve?word=${encodeURIComponent(audioKey)}`;
}

export function pictureMatchImageUrl(word: string): string {
  return `/api/image/resolve?word=${encodeURIComponent(word)}&style=kid-illustration`;
}

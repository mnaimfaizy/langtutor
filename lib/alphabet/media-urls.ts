/** Same-origin media resolve URLs for the alphabet activity (issue #71). */
export function alphabetAudioUrl(letter: string): string {
  return `/api/audio/resolve?word=${encodeURIComponent(letter)}`;
}

export function alphabetImageUrl(pictureWord: string): string {
  return `/api/image/resolve?word=${encodeURIComponent(pictureWord)}&style=kid-illustration`;
}

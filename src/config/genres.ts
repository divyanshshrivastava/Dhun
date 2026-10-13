// Musical genres across Indian sounds

export const MUSIC_GENRES = [
  'Bollywood',
  'Romantic',
  'Dance / Party',
  'Sufi',
  'Ghazal',
  'Sad / Melancholy',
  'Classical / Fusion',
  'Folk',
  'Indie Pop',
  'Qawwali',
  'Devotional',
] as const;

export type GenreName = typeof MUSIC_GENRES[number];

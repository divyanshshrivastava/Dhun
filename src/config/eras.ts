// Musical eras for practice filtering

export const MUSIC_ERAS = [
  { id: '70s', label: '70s & Earlier', description: 'Retro classics, R.D. Burman, Kishore Kumar' },
  { id: '80s', label: '80s Era', description: 'Disco, Ilaiyaraaja, Bappi Lahiri' },
  { id: '90s', label: '90s Golden Melodies', description: 'Nadeem-Shravan, A.R. Rahman, Kumar Sanu, Alka Yagnik' },
  { id: '2000s', label: '2000s Millennial Hits', description: 'Shankar-Ehsaan-Loy, Pritam, early Arijit era' },
  { id: '2010s', label: '2010s Modern Anthems', description: 'Arijit Singh, Amit Trivedi, Anirudh' },
  { id: '2020s', label: '2020s Contemporary Hits', description: 'Viral sensations, modern indie, new wave' },
] as const;

export type EraId = typeof MUSIC_ERAS[number]['id'];
